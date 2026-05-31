class PCMPlayerProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 24000 * 180;
    this.buffer = new Float32Array(this.bufferSize);
    this.writeIndex = 0;
    this.readIndex = 0;

    this.port.onmessage = (event) => {
      if (event.data.command === "clear") {
        this.readIndex = this.writeIndex;
        return;
      }
      const int16Samples = new Int16Array(event.data);
      for (let i = 0; i < int16Samples.length; i++) {
        this.buffer[this.writeIndex] = int16Samples[i] / 32768;
        this.writeIndex = (this.writeIndex + 1) % this.bufferSize;
        if (this.writeIndex === this.readIndex) {
          this.readIndex = (this.readIndex + 1) % this.bufferSize;
        }
      }
    };
  }

  process(_inputs, outputs) {
    const output = outputs[0];
    const frames = output[0].length;

    for (let frame = 0; frame < frames; frame++) {
      const sample = this.readIndex !== this.writeIndex ? this.buffer[this.readIndex] : 0;
      output[0][frame] = sample;
      if (output.length > 1) output[1][frame] = sample;
      if (this.readIndex !== this.writeIndex) {
        this.readIndex = (this.readIndex + 1) % this.bufferSize;
      }
    }

    return true;
  }
}

registerProcessor("pcm-player-processor", PCMPlayerProcessor);
