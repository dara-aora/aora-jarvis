const INPUT_SAMPLE_RATE = 16000;
const OUTPUT_SAMPLE_RATE = 24000;

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  let standard = base64.replace(/-/g, "+").replace(/_/g, "/");
  while (standard.length % 4) standard += "=";
  const binary = atob(standard);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function float32ToPcm16(float32: Float32Array): ArrayBuffer {
  const pcm16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const sample = Math.max(-1, Math.min(1, float32[i]));
    pcm16[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return pcm16.buffer;
}

function downsample(input: Float32Array, inputRate: number, outputRate: number): Float32Array {
  if (inputRate === outputRate) return input;
  const ratio = inputRate / outputRate;
  const outputLength = Math.floor(input.length / ratio);
  const output = new Float32Array(outputLength);
  for (let i = 0; i < outputLength; i++) {
    output[i] = input[Math.floor(i * ratio)];
  }
  return output;
}

export class MicCapture {
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private recorderNode: AudioWorkletNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private onChunk: ((base64Pcm: string) => void) | null = null;

  async start(onChunk: (base64Pcm: string) => void): Promise<void> {
    this.onChunk = onChunk;
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    this.audioContext = new AudioContext({ sampleRate: INPUT_SAMPLE_RATE });
    await this.audioContext.audioWorklet.addModule("/pcm-recorder-processor.js");

    this.source = this.audioContext.createMediaStreamSource(this.stream);
    this.recorderNode = new AudioWorkletNode(this.audioContext, "pcm-recorder-processor");

    this.recorderNode.port.onmessage = (event: MessageEvent<Float32Array>) => {
      const resampled = downsample(event.data, this.audioContext!.sampleRate, INPUT_SAMPLE_RATE);
      const pcm = float32ToPcm16(resampled);
      this.onChunk?.(arrayBufferToBase64(pcm));
    };

    this.source.connect(this.recorderNode);
    const mute = this.audioContext.createGain();
    mute.gain.value = 0;
    this.recorderNode.connect(mute);
    mute.connect(this.audioContext.destination);

    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }
  }

  stop(): void {
    this.recorderNode?.disconnect();
    this.source?.disconnect();
    this.stream?.getTracks().forEach((t) => t.stop());
    void this.audioContext?.close();
    this.recorderNode = null;
    this.source = null;
    this.stream = null;
    this.audioContext = null;
    this.onChunk = null;
  }
}

export class AudioPlaybackQueue {
  private ctx: AudioContext;
  private playerNode: AudioWorkletNode | null = null;
  private ready: Promise<void>;

  constructor() {
    this.ctx = new AudioContext({ sampleRate: OUTPUT_SAMPLE_RATE });
    this.ready = this.initWorklet();
  }

  private async initWorklet(): Promise<void> {
    await this.ctx.audioWorklet.addModule("/pcm-player-processor.js");
    this.playerNode = new AudioWorkletNode(this.ctx, "pcm-player-processor");
    this.playerNode.connect(this.ctx.destination);
  }

  async resume(): Promise<void> {
    await this.ready;
    if (this.ctx.state === "suspended") {
      await this.ctx.resume();
    }
  }

  async enqueueBase64Pcm(base64: string): Promise<void> {
    await this.ready;
    if (!this.playerNode) return;
    const buffer = base64ToArrayBuffer(base64);
    this.playerNode.port.postMessage(buffer);
  }

  interrupt(): void {
    this.playerNode?.port.postMessage({ command: "clear" });
  }

  close(): void {
    this.interrupt();
    this.playerNode?.disconnect();
    void this.ctx.close();
    this.playerNode = null;
  }
}
