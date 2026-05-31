"""
eeg_server.py — Optimised for right-side temporal montage
CH1 = behind ear (mastoid)
CH2 = above/behind ear (T8 area)  ← primary EEG signal
GND = earlobe

Key changes vs previous:
- CH2 is the PRIMARY channel (T8 = best EEG site in this montage)
- CH1 used as secondary / differential reference
- Differential signal (CH2 - CH1) computed as 3rd virtual channel
- Longer calibration (40s per state)
- More features including asymmetry + spectral edge
- No artifact rejection — filtering handles noise
"""

import asyncio
import json
import collections
import numpy as np
import websockets
from scipy.signal import welch, iirnotch, sosfilt, butter, lfilter

from brainflow.board_shim import BoardShim, BrainFlowInputParams, BoardIds
from fatigue import fatigue_features, FatigueIndex, check_signal_quality

WINDOW_SEC   = 4.0
WS_PORT      = 8765
EWMA_ALPHA   = 0.2
CAL_DURATION = 40     # 40s per state — more data = better centroid
NOTCH_FREQ   = 50.0   # change to 60.0 if in North America

BANDS = {
    'delta': (1.0,  4.0),
    'theta': (4.0,  7.5),
    'alpha': (8.0,  13.0),
    'beta':  (13.0, 30.0),
    'high_beta': (20.0, 30.0),  # stress-specific sub-band
}

# ── Gesture signal preprocessing (no EEG bandpass, preserves full spectrum) ──
def preprocess_raw(sig, sr):
    x = sig.copy().astype(np.float64)
    x -= np.mean(x)
    t  = np.arange(len(x))
    x -= np.polyval(np.polyfit(t, x, 1), t)
    nyq = sr / 2.0
    f0  = NOTCH_FREQ / nyq
    if f0 < 1.0:
        b_n, a_n = iirnotch(f0, Q=35.0)
        x = lfilter(b_n, a_n, x)
    return x

def eog_filter(sig, sr):
    """0.3–4 Hz bandpass — extracts slow-wave component for eye movement direction."""
    nyq = sr / 2.0
    sos = butter(2, [0.3/nyq, 4.0/nyq], btype='band', output='sos')
    return sosfilt(sos, sig)

def emg_filter(sig, sr):
    """30–95 Hz bandpass — extracts jaw/muscle EMG for clench detection."""
    nyq = sr / 2.0
    hi  = min(95.0, nyq - 1.0)
    sos = butter(4, [30.0/nyq, hi/nyq], btype='band', output='sos')
    return sosfilt(sos, sig)

# ── Signal cleaning ───────────────────────────────────────────────────────────
def clean(sig, sr):
    x = sig.copy().astype(np.float64)
    # DC + drift removal
    x -= np.mean(x)
    t  = np.arange(len(x))
    x -= np.polyval(np.polyfit(t, x, 1), t)
    # Notch 50Hz
    nyq = sr / 2.0
    f0  = NOTCH_FREQ / nyq
    if f0 < 1.0:
        b_n, a_n = iirnotch(f0, Q=35.0)
        x = lfilter(b_n, a_n, x)
    # Bandpass 1–40Hz
    sos = butter(4, [1.0/nyq, min(40.0, nyq-1)/nyq], btype='band', output='sos')
    x   = sosfilt(sos, x)
    return x

# ── Welch PSD ─────────────────────────────────────────────────────────────────
def psd_bands(sig, sr):
    nperseg = min(len(sig), int(sr * 2))
    f, p    = welch(sig, fs=sr, nperseg=nperseg, noverlap=nperseg//2,
                    window='hann', detrend='linear')
    out = {}
    for name, (lo, hi) in BANDS.items():
        idx = (f >= lo) & (f <= hi)
        out[name] = float(np.trapz(p[idx], f[idx])) if idx.any() else 1e-9
    # Spectral edge frequency (95%) — rises under cognitive load
    total_p = np.trapz(p, f) + 1e-9
    cum     = np.cumsum(p * np.gradient(f))
    sef_idx = np.searchsorted(cum / cum[-1], 0.95)
    out['sef95'] = float(f[min(sef_idx, len(f)-1)])
    # Alpha centroid frequency — power-weighted mean of 8-13 Hz.
    # More stable than peak bin, which jumps discretely with short windows.
    a_idx = (f >= 8.0) & (f <= 13.0)
    if a_idx.any():
        p_a = p[a_idx]; f_a = f[a_idx]
        out['apf'] = float(np.sum(p_a * f_a) / (np.sum(p_a) + 1e-9))
    else:
        out['apf'] = 10.5
    return out

# ── Hunger features ───────────────────────────────────────────────────────────
def hunger_features(p2, p1):
    """
    Hunger-relevant spectral features from temporal EEG (T8 + mastoid).

    Science basis:
    - Temporal alpha (8-13 Hz) increases ~15-25% during hunger via gut-brain
      axis signalling through the vagus nerve (Khader et al. 2013; Haegens et al.)
    - Theta/alpha ratio (TAR) rises as theta increases relative to alpha
    - Spectral edge frequency (SEF95) decreases — brain rhythm slows
    - Alpha/delta ratio (ADR) falls as delta increases with hunger
    """
    alpha = max(p2['alpha'], 1e-9)
    theta = max(p2['theta'], 1e-9)
    delta = max(p2['delta'], 1e-9)
    beta  = max(p2['beta'],  1e-9)
    total = alpha + theta + delta + beta
    return {
        'rel_alpha': alpha / total,
        'tar':       theta / alpha,
        'adr':       alpha / (delta + 1e-9),
        'sef95':     p2.get('sef95', 20.0),
    }

# ── Rich feature vector ───────────────────────────────────────────────────────
def feature_vec(ch2, ch1, diff):
    """
    ch2  = T8 area (primary, above/behind ear)
    ch1  = mastoid (secondary, behind ear)
    diff = ch2 - ch1 (differential — removes common noise)
    """
    def _feats(p):
        a  = max(p['alpha'],     1e-9)
        t  = max(p['theta'],     1e-9)
        b  = max(p['beta'],      1e-9)
        hb = max(p['high_beta'], 1e-9)
        d  = max(p['delta'],     1e-9)
        total = a + t + b + d + 1e-9
        return [
            a / total,           # alpha relative
            t / total,           # theta relative
            b / total,           # beta relative
            hb / total,          # high-beta relative
            b / a,               # beta/alpha  (stress)
            t / a,               # theta/alpha (concentration)
            a / (t + b + 1e-9),  # alpha dominance (relaxation)
            np.log1p(b / a),     # log beta/alpha
            p.get('sef95', 20),  # spectral edge
        ]

    f2   = _feats(ch2)
    f1   = _feats(ch1)
    fdif = _feats(diff)

    # Differential features (CH2 - CH1 power ratios as extra discriminant)
    alpha_asym = (ch2['alpha'] - ch1['alpha']) / (ch2['alpha'] + ch1['alpha'] + 1e-9)
    beta_asym  = (ch2['beta']  - ch1['beta'])  / (ch2['beta']  + ch1['beta']  + 1e-9)

    return np.array(f2 + f1 + fdif + [alpha_asym, beta_asym], dtype=np.float64)

# ── Smoothers ─────────────────────────────────────────────────────────────────
class EWMA:
    def __init__(self, a=EWMA_ALPHA):
        self.a = a; self.v = None
    def update(self, x):
        self.v = x if self.v is None else self.a*x + (1-self.a)*self.v
        return self.v

class MedianBuf:
    def __init__(self, n=7):
        self.buf = collections.deque(maxlen=n)
    def update(self, x):
        self.buf.append(x); return float(np.median(self.buf))

# ── Calibration ───────────────────────────────────────────────────────────────
class Calibration:
    def __init__(self):
        self.data = {}

    def add(self, state, vec):
        self.data.setdefault(state, []).append(vec)

    def finalize(self):
        self.centroids = {}
        for state, vecs in self.data.items():
            arr = np.stack(vecs)
            self.centroids[state] = {
                'mean': arr.mean(0),
                'std':  arr.std(0) + 1e-6,
            }
            print(f"[CAL] {state}: {len(vecs)} samples  "
                  f"feature_mean={np.round(arr.mean(0)[:4], 3)}")

    def classify(self, vec):
        if not hasattr(self, 'centroids'): return None
        dists = {}
        for state, c in self.centroids.items():
            z = (vec - c['mean']) / c['std']
            dists[state] = float(np.sqrt(np.mean(z**2)))
        keys = list(dists)
        d    = np.array([dists[k] for k in keys])
        inv  = np.exp(-d * 1.5)   # sharpen separation
        prob = inv / (inv.sum() + 1e-9)
        return {k: float(p) for k, p in zip(keys, prob)}

    @property
    def ready(self):
        return hasattr(self, 'centroids') and len(self.centroids) == 3

# ── Hunger index (no personal calibration — relative-change approach) ─────────
class HungerIndex:
    """
    Tracks a 60-second rolling baseline then scores hunger 0-100.

    Score  0-30 → WELL FED
           30-45 → SATISFIED
           45-60 → NEUTRAL
           60-72 → PECKISH
           72-85 → HUNGRY
           85+   → VERY HUNGRY

    Weights: alpha↑ (40%), TAR↑ (30%), SEF↓ (20%), ADR↓ (10%).
    """
    BASELINE_SEC   = 60
    UPDATES_PER_S  = 2    # eeg_loop fires every 0.5 s

    def __init__(self):
        self._samples    = []
        self._baseline   = None
        self._score_buf  = collections.deque(maxlen=20)
        self.ready        = False
        self.baseline_pct = 0.0

    def update(self, feats):
        """Return (score_or_None, label_str)."""
        required = self.BASELINE_SEC * self.UPDATES_PER_S

        if not self.ready:
            self._samples.append(feats)
            self.baseline_pct = min(len(self._samples) / required, 1.0)
            if len(self._samples) >= required:
                self._lock_baseline()
                self.ready = True
            return None, "MEASURING"

        bl = self._baseline
        def z(k):
            return (feats[k] - bl[k]['mean']) / bl[k]['std']

        raw = (0.40 *  z('rel_alpha')   # alpha up   → hungry
             + 0.30 *  z('tar')         # TAR up     → hungry
             + 0.20 * -z('sef95')       # SEF down   → hungry
             + 0.10 * -z('adr'))        # ADR down   → hungry

        score = float(np.clip(50.0 + raw * 8.0, 0, 100))
        self._score_buf.append(score)
        smoothed = float(np.mean(self._score_buf))

        label = (
            "WELL FED"    if smoothed < 30 else
            "SATISFIED"   if smoothed < 45 else
            "NEUTRAL"     if smoothed < 60 else
            "PECKISH"     if smoothed < 72 else
            "HUNGRY"      if smoothed < 85 else
            "VERY HUNGRY"
        )
        return smoothed, label

    def _lock_baseline(self):
        self._baseline = {}
        for key in self._samples[0]:
            vals = [s[key] for s in self._samples]
            self._baseline[key] = {
                'mean': float(np.mean(vals)),
                'std':  max(float(np.std(vals)), 1e-4),
            }
        bl = self._baseline
        print(f"[HUNGER] Baseline locked — "
              f"α={bl['rel_alpha']['mean']:.3f}  "
              f"TAR={bl['tar']['mean']:.3f}  "
              f"SEF={bl['sef95']['mean']:.1f} Hz")

# ── Gesture detector (eye movement + jaw clench) ─────────────────────────────
class GestureDetector:
    """
    Detects three gestures from CH1 (right mastoid electrode):

    jaw_clench  — broadband EMG burst 30-95 Hz (masseter near mastoid)
    eye_right   — positive 0.3-4 Hz slow wave (cornea-retina dipole, rightward gaze)
    eye_left    — negative 0.3-4 Hz slow wave (leftward gaze)

    Uses adaptive z-score thresholds built from a rolling baseline so the
    detector self-calibrates to the individual's signal amplitude.
    """
    BASELINE_N = 60   # 30 s warmup at 2 Hz update rate
    REFRACTORY = 4    # 2 s between detections (prevent double-firing)
    EMG_Z      = 4.0  # jaw clench threshold (sigma)
    EOG_Z      = 3.0  # eye movement threshold (sigma)
    MIN_N      = 10   # minimum baseline samples before enabling

    def __init__(self):
        self._emg_buf = collections.deque(maxlen=self.BASELINE_N)
        self._eog_buf = collections.deque(maxlen=self.BASELINE_N)
        self._refrac  = 0
        self.ready    = False

    def update(self, ch1_raw, sr):
        win_emg = max(int(0.3 * sr), 1)   # 300 ms RMS window
        win_eog = max(int(0.5 * sr), 1)   # 500 ms mean window

        raw = preprocess_raw(ch1_raw, sr)
        eog = eog_filter(raw, sr)
        emg = emg_filter(raw, sr)

        emg_rms  = float(np.sqrt(np.mean(emg[-win_emg:]**2)))
        eog_mean = float(np.mean(eog[-win_eog:]))

        self._emg_buf.append(emg_rms)
        self._eog_buf.append(abs(eog_mean))
        self.ready = len(self._emg_buf) >= self.MIN_N

        if self._refrac > 0:
            self._refrac -= 1
            return {"type": None, "confidence": 0.0, "ready": self.ready}

        if not self.ready:
            return {"type": None, "confidence": 0.0, "ready": self.ready}

        emg_m = float(np.mean(self._emg_buf));  emg_s = max(float(np.std(self._emg_buf)), 1e-8)
        eog_m = float(np.mean(self._eog_buf));  eog_s = max(float(np.std(self._eog_buf)), 1e-8)

        emg_z = (emg_rms         - emg_m) / emg_s
        eog_z = (abs(eog_mean)   - eog_m) / eog_s

        gesture = None;  confidence = 0.0

        if emg_z > self.EMG_Z:
            gesture    = "jaw_clench"
            confidence = min(emg_z / self.EMG_Z, 1.0)
            self._refrac = self.REFRACTORY
        elif eog_z > self.EOG_Z:
            gesture    = "eye_right" if eog_mean > 0 else "eye_left"
            confidence = min(eog_z / self.EOG_Z, 1.0)
            self._refrac = self.REFRACTORY

        return {"type": gesture, "confidence": round(confidence, 3), "ready": self.ready}

# ── WebSocket ─────────────────────────────────────────────────────────────────
clients = set()

# Shared session state — synced to newly connected UI clients
session_state = {
    "phase": "waiting_for_ui",
    "cal_state": None,
    "cal_label": None,
    "cal_instruction": None,
    "cal_progress": 0,
    "cal_countdown": 0,
    "cal_samples": 0,
    "cal_done": [],
}

def _cal_meta(state_key):
    for key, label, instruction in CAL_SEQUENCE:
        if key == state_key:
            return label, instruction
    return state_key, ""

async def broadcast(msg):
    if clients:
        d = json.dumps(msg)
        await asyncio.gather(*[c.send(d) for c in clients], return_exceptions=True)

async def ws_handler(ws):
    clients.add(ws)
    print(f"[WS] Connected ({len(clients)})")
    # Sync current session to late-connecting UI
    await ws.send(json.dumps({"type": "sync", **session_state}))
    try:    await ws.wait_closed()
    finally: clients.discard(ws)

# ── Calibration flow ──────────────────────────────────────────────────────────
CAL_SEQUENCE = [
    ("relaxation",
     "RELAXED",
     "Close eyes · breathe slowly (4 counts in, 6 out) · completely empty your mind"),
    ("concentration",
     "FOCUSED",
     "Eyes open · solve this: 300 − 7 − 7 − 7... keep going · stay locked in"),
    ("stress",
     "STRESSED",
     "Eyes open · imagine a tense deadline · your heart is racing · feel it"),
]

async def calibrate(board, sr, ch1_idx, ch2_idx, win_samples):
    cal = Calibration()
    session_state["phase"] = "calibrating"
    session_state["cal_done"] = []

    for state_key, label, instruction in CAL_SEQUENCE:
        print(f"\n[CAL] ── {label} ── preparing 4s")
        session_state.update({
            "cal_state": state_key,
            "cal_label": label,
            "cal_instruction": instruction,
            "cal_progress": 0,
            "cal_countdown": 4,
            "cal_samples": 0,
        })
        await broadcast({
            "type": "cal_phase", "state": state_key,
            "label": label, "instruction": instruction, "countdown": 4,
        })
        await asyncio.sleep(4)

        start = asyncio.get_event_loop().time()
        n     = 0
        session_state["cal_countdown"] = 0

        while True:
            elapsed  = asyncio.get_event_loop().time() - start
            progress = min(elapsed / CAL_DURATION, 1.0)

            wave_ch1, wave_ch2 = [], []
            data = board.get_current_board_data(win_samples)
            if data.shape[1] >= win_samples:
                sig1   = clean(data[ch1_idx, :], sr)
                sig2   = clean(data[ch2_idx, :], sr)
                sig_df = sig2 - sig1          # differential

                step = max(1, len(sig1) // 90)
                wave_ch1 = [round(float(v), 2) for v in sig1[::step][-90:]]
                wave_ch2 = [round(float(v), 2) for v in sig2[::step][-90:]]

                p1   = psd_bands(sig1,   sr)
                p2   = psd_bands(sig2,   sr)
                p_df = psd_bands(sig_df, sr)

                vec = feature_vec(p2, p1, p_df)
                cal.add(state_key, vec)
                n += 1

            session_state.update({
                "cal_progress": round(progress, 3),
                "cal_samples": n,
            })
            await broadcast({
                "type": "cal_progress", "state": state_key,
                "progress": round(progress, 3), "samples": n, "skipped": 0,
                "waveform": {"ch1": wave_ch1, "ch2": wave_ch2},
            })
            print(f"[CAL] {label} {int(progress*100):3d}%  samples={n}")

            if elapsed >= CAL_DURATION:
                break
            await asyncio.sleep(0.5)

        session_state["cal_done"] = session_state["cal_done"] + [state_key]
        await broadcast({"type": "cal_done", "state": state_key, "samples": n})
        print(f"[CAL] {label} done — {n} samples")

    cal.finalize()
    session_state["phase"] = "live"
    await broadcast({"type": "cal_complete"})
    return cal

# ── EEG loop ──────────────────────────────────────────────────────────────────
async def eeg_loop():
    params   = BrainFlowInputParams()
    board_id = BoardIds.GANGLION_NATIVE_BOARD.value
    board    = BoardShim(board_id, params)

    print("Connecting to Ganglion...")
    board.prepare_session()
    board.start_stream()

    sr          = BoardShim.get_sampling_rate(board_id)
    eeg_chs     = BoardShim.get_eeg_channels(board_id)

    # CH1 = eeg_chs[0] (mastoid/behind ear)
    # CH2 = eeg_chs[1] (T8/above-behind ear) ← primary
    ch1_idx     = eeg_chs[0]
    ch2_idx     = eeg_chs[1]
    win_samples = int(WINDOW_SEC * sr)

    print(f"[INFO] SR={sr}Hz  window={WINDOW_SEC}s")
    print(f"[INFO] CH1=mastoid(behind ear)  CH2=T8(above-behind ear)")
    print(f"[INFO] Montage: differential CH2-CH1 + individual channels")
    await asyncio.sleep(2)

    session_state["phase"] = "waiting_for_ui"
    await broadcast({"type": "status", "phase": "connecting"})
    print("[INFO] Waiting for UI client before calibration…")
    while len(clients) == 0:
        await asyncio.sleep(0.3)

    print("[INFO] UI connected — starting calibration")
    await broadcast({"type": "status", "phase": "calibrating"})
    cal = await calibrate(board, sr, ch1_idx, ch2_idx, win_samples)

    smoothers = {k: EWMA()      for k in ('relaxation','concentration','stress')}
    medians   = {k: MedianBuf() for k in ('relaxation','concentration','stress')}

    # Hunger index starts tracking baseline from the first live frame
    hunger  = HungerIndex()
    fatigue = FatigueIndex()
    gest    = GestureDetector()

    await broadcast({"type": "status", "phase": "live"})
    print("[LIVE] Running")

    try:
        while True:
            data = board.get_current_board_data(win_samples)
            if data.shape[1] < win_samples:
                await asyncio.sleep(0.1)
                continue

            sig1   = clean(data[ch1_idx, :], sr)
            sig2   = clean(data[ch2_idx, :], sr)
            sig_df = sig2 - sig1

            p1   = psd_bands(sig1,   sr)
            p2   = psd_bands(sig2,   sr)
            p_df = psd_bands(sig_df, sr)

            vec    = feature_vec(p2, p1, p_df)
            raw    = cal.classify(vec)
            if raw is None:
                await asyncio.sleep(0.5)
                continue

            med    = {k: medians[k].update(raw[k])    for k in raw}
            smooth = {k: smoothers[k].update(med[k])  for k in med}
            state  = max(smooth, key=smooth.get)

            # Hunger index
            h_feats        = hunger_features(p2, p1)
            h_score, h_lbl = hunger.update(h_feats)

            # Fatigue index — artifact-gated
            f_ok                           = check_signal_quality(data[ch2_idx, :], data[ch1_idx, :], sr)
            f_feats                        = fatigue_features(p2, p1)
            f_score, f_lbl, f_cof, f_qual = fatigue.update(f_feats, quality_ok=f_ok)
            if f_cof and f_score is not None:
                print(f"[FATIGUE] {f_lbl}  score={f_score:.0f}  quality={f_qual:.2f}  ☕ COFFEE RECOMMENDED")

            # Gesture detection (eye movement + jaw clench)
            g = gest.update(data[ch1_idx, :], sr)
            if g["type"]:
                print(f"[GESTURE] {g['type'].upper()}  conf={g['confidence']:.2f}")

            print(
                f"[{state.upper():<13}] "
                f"relax={smooth['relaxation']:.2f}  "
                f"conc={smooth['concentration']:.2f}  "
                f"stress={smooth['stress']:.2f}  "
                f"α={p2['alpha']:.3f} θ={p2['theta']:.3f} β={p2['beta']:.3f}"
                + (f"  hunger={h_score:.0f}({h_lbl})" if h_score is not None
                   else f"  hunger=baseline {hunger.baseline_pct*100:.0f}%")
                + (f"  fatigue={f_score:.0f}({f_lbl})" if f_score is not None
                   else f"  fatigue=baseline {fatigue.baseline_pct*100:.0f}%")
            )

            step = max(1, len(sig1) // 90)
            wave_ch1 = [round(float(v), 2) for v in sig1[::step][-90:]]
            wave_ch2 = [round(float(v), 2) for v in sig2[::step][-90:]]

            await broadcast({
                "type":       "data",
                "state":      state,
                "scores":     {k: round(v,3) for k,v in smooth.items()},
                "bands":      {k: round(p2.get(k,0),4)
                               for k in ('delta','theta','alpha','beta')},
                "waveform":   {"ch1": wave_ch1, "ch2": wave_ch2},
                "ch1_uv":     round(float(sig1[-1]), 2),
                "ch2_uv":     round(float(sig2[-1]), 2),
                "calibrated": True,
                "hunger": {
                    "score": round(h_score, 1) if h_score is not None else None,
                    "state": h_lbl,
                    "ready": hunger.ready,
                    "pct":   round(hunger.baseline_pct, 3),
                },
                "fatigue": {
                    "score":         round(f_score, 1) if f_score is not None else None,
                    "state":         f_lbl,
                    "ready":         fatigue.ready,
                    "pct":           round(fatigue.baseline_pct, 3),
                    "coffee_needed": f_cof,
                    "quality":       round(f_qual, 2),
                },
                "gesture": {
                    "type":       g["type"],
                    "confidence": g["confidence"],
                    "ready":      g["ready"],
                },
            })

            await asyncio.sleep(0.5)

    except asyncio.CancelledError:
        pass
    finally:
        board.stop_stream()
        board.release_session()
        print("Board released.")

async def main():
    server = await websockets.serve(ws_handler, "localhost", WS_PORT)
    print(f"[WS] ws://localhost:{WS_PORT}")
    await asyncio.gather(server.serve_forever(), eeg_loop())

if __name__ == "__main__":
    asyncio.run(main())