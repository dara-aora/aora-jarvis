class PCMRecorderProcessor extends AudioWorkletProcessor {
  process(inputs) {
    if (inputs.length > 0 && inputs[0].length > 0) {
      const channel = inputs[0][0];
      if (channel) {
        this.port.postMessage(new Float32Array(channel));
      }
    }
    return true;
  }
}

registerProcessor("pcm-recorder-processor", PCMRecorderProcessor);
