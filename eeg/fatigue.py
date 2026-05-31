"""
fatigue.py — Hackathon-tuned fatigue detector

Priorities: catch obvious sleepiness fast. Not clinical, but reliable enough
that when you're genuinely fighting to stay awake, it fires.

Key decisions:
- 60s baseline (not 3 min) — you want it running within a minute
- 3 features only: TBR, rel_alpha, rel_beta — the three that actually work
  at temporal sites. APF and SEF add noise more than signal here.
- 8s feature EWMA (not 15s) — faster response
- Coffee threshold 55, sustain 30s — catches real sleepiness without being
  so conservative it never fires
- Still artifact-gated so jaw clenches don't trigger it
"""

import collections
import numpy as np
from scipy.signal import butter, sosfilt


# ── Artifact rejection ────────────────────────────────────────────────────────

def _kurtosis(x):
    x = x - np.mean(x)
    var = np.mean(x ** 2)
    return float(np.mean(x ** 4) / (var ** 2 + 1e-9) - 3.0)


def check_signal_quality(raw_ch2, raw_ch1, sr):
    """Rejects dead electrode, movement artifacts, and EMG-contaminated frames."""
    for sig in (raw_ch2, raw_ch1):
        if np.std(sig) < 0.5:
            return False
        if abs(_kurtosis(sig)) > 12:
            return False

    nyq     = sr / 2.0
    hi      = min(95.0, nyq - 1.0)
    sos_emg = butter(4, [30.0 / nyq, hi / nyq],               btype='band', output='sos')
    sos_eeg = butter(4, [1.0  / nyq, min(40.0, nyq-1) / nyq], btype='band', output='sos')
    emg_rms = np.sqrt(np.mean(sosfilt(sos_emg, raw_ch2) ** 2))
    eeg_rms = np.sqrt(np.mean(sosfilt(sos_eeg, raw_ch2) ** 2)) + 1e-9

    return (emg_rms / eeg_rms) <= 2.0


# ── Feature extraction ────────────────────────────────────────────────────────

def fatigue_features(p2, p1):
    """3 features that actually move at temporal sites when you're sleepy."""
    alpha = max(p2['alpha'], 1e-9)
    theta = max(p2['theta'], 1e-9)
    beta  = max(p2['beta'],  1e-9)
    delta = max(p2['delta'], 1e-9)
    total = alpha + theta + beta + delta
    return {
        'tbr':       theta / beta,    # rises sharply when drowsy
        'rel_alpha': alpha / total,   # surges with eyes-open drowsiness
        'rel_beta':  beta  / total,   # drops as alertness falls
    }


# ── Feature smoother ──────────────────────────────────────────────────────────

class FeatureSmoother:
    """
    8-second EWMA on each feature before scoring.
    Stops single noisy 4s windows from flipping the vote.
    ALPHA = 0.06 → τ = 1/(2×0.06) ≈ 8s at 2Hz updates.
    """
    ALPHA = 0.06

    def __init__(self):
        self._v = None

    def update(self, feats):
        if self._v is None:
            self._v = dict(feats)
        else:
            for k in feats:
                self._v[k] = (1.0 - self.ALPHA) * self._v[k] + self.ALPHA * feats[k]
        return dict(self._v)


# ── Fatigue index ─────────────────────────────────────────────────────────────

class FatigueIndex:
    """
    Scores fatigue 0-100.

    Score  0-30  → ALERT
           30-50 → OK
           50-65 → GETTING TIRED
           65-80 → TIRED          ← coffee zone
           80+   → VERY TIRED     ← coffee strongly needed

    Coffee fires once score ≥ 55 sustained for ~30 seconds.
    """
    WARMUP_SEC     = 60     # 1-minute baseline — fast enough for a demo
    UPDATES_PER_S  = 2
    SCORE_BUF_N    = 5
    COFFEE_THRESH  = 55
    COFFEE_SUSTAIN = 60     # 30s at 2Hz
    ADAPT_ALPHA    = 1/1200 # baseline drifts slowly when alert (~10min τ)
    ALERT_CEILING  = 45

    def __init__(self):
        self._smoother       = FeatureSmoother()
        self._samples        = []
        self._baseline       = None
        self._score_buf      = collections.deque(maxlen=self.SCORE_BUF_N)
        self._above_thresh   = 0
        self._total_frames   = 0
        self._skipped_frames = 0
        self.ready           = False
        self.baseline_pct    = 0.0
        self.coffee_needed   = False

    def update(self, feats, quality_ok=True):
        """Returns (score_or_None, label, coffee_needed, quality_ratio)."""
        required      = self.WARMUP_SEC * self.UPDATES_PER_S
        self._total_frames += 1
        quality_ratio = 1.0 - self._skipped_frames / max(self._total_frames, 1)

        if not quality_ok:
            self._skipped_frames += 1
            quality_ratio = 1.0 - self._skipped_frames / max(self._total_frames, 1)
            if not self.ready:
                return None, "MEASURING", False, quality_ratio
            last = float(np.mean(self._score_buf)) if self._score_buf else 50.0
            return last, self._label(last), self.coffee_needed, quality_ratio

        smooth_feats = self._smoother.update(feats)

        if not self.ready:
            self._samples.append(smooth_feats)
            self.baseline_pct = min(len(self._samples) / required, 1.0)
            if len(self._samples) < required:
                return None, "MEASURING", False, quality_ratio
            self._lock_baseline()
            self.ready = True

        bl = self._baseline

        def z(k):
            return (smooth_feats[k] - bl[k]['mean']) / bl[k]['std']

        # 3-feature vote. tanh prevents any one feature dominating.
        votes = (
            3.0 * np.tanh(z('tbr'))        # strongest signal at temporal sites
          + 2.5 * np.tanh(z('rel_alpha'))  # very visible when genuinely drowsy
          + 2.5 * np.tanh(-z('rel_beta'))  # reliable drop with fatigue
        )
        # votes range: [-8, +8]. Map to [0, 100].
        score = float(np.clip(50.0 + votes * 6.25, 0, 100))

        self._score_buf.append(score)
        smoothed = float(np.mean(self._score_buf))

        # Only update baseline when clearly alert
        if smoothed < self.ALERT_CEILING:
            for key, val in smooth_feats.items():
                bl[key]['mean'] = (
                    (1.0 - self.ADAPT_ALPHA) * bl[key]['mean']
                    + self.ADAPT_ALPHA * val
                )

        if smoothed >= self.COFFEE_THRESH:
            self._above_thresh += 1
        else:
            self._above_thresh = max(0, self._above_thresh - 2)

        self.coffee_needed = self._above_thresh >= self.COFFEE_SUSTAIN

        return smoothed, self._label(smoothed), self.coffee_needed, quality_ratio

    def _label(self, score):
        return (
            "ALERT"        if score < 30 else
            "OK"           if score < 50 else
            "GETTING TIRED" if score < 65 else
            "TIRED"        if score < 80 else
            "VERY TIRED"
        )

    def _lock_baseline(self):
        self._baseline = {}
        for key in self._samples[0]:
            vals = [s[key] for s in self._samples]
            self._baseline[key] = {
                'mean': float(np.mean(vals)),
                'std':  max(float(np.std(vals)), 1e-4),
            }
        bl = self._baseline
        print(
            f"[FATIGUE] Baseline ready — "
            f"TBR={bl['tbr']['mean']:.3f}  "
            f"α={bl['rel_alpha']['mean']:.3f}  "
            f"β={bl['rel_beta']['mean']:.3f}"
        )
