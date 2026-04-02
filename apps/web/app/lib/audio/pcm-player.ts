/**
 * PCMPlayer — plays PCM16 audio (24 kHz, mono) via the Web Audio API.
 *
 * Supports two modes:
 * 1. `playPcm16(buffer)` — one-shot playback of a complete buffer.
 * 2. `enqueue(chunk)` / `flush()` — streaming playback: schedule chunks as
 *    they arrive so audio starts playing before the full response is
 *    downloaded. Call `flush()` after the last chunk to await completion.
 */
export class PCMPlayer {
  private audioContext: AudioContext | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;

  /** Tracks the next playback time for seamless streaming chunk scheduling. */
  private nextStartTime = 0;
  /** Resolves when the final scheduled chunk finishes playing. */
  private streamEndPromise: Promise<void> | null = null;
  private streamEndResolve: (() => void) | null = null;
  /** Number of chunks currently scheduled / playing. */
  private pendingChunks = 0;

  private getContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new AudioContext({ sampleRate: 24000 });
    }
    return this.audioContext;
  }

  private pcm16ToFloat32(arrayBuffer: ArrayBuffer): Float32Array<ArrayBuffer> {
    const pcmData = new Int16Array(arrayBuffer);
    const floatData = new Float32Array(new ArrayBuffer(pcmData.length * 4));
    for (const [index, sample] of pcmData.entries()) {
      floatData[index] = sample / 32768;
    }
    return floatData;
  }

  // ---------------------------------------------------------------------------
  // One-shot playback (existing API, preserved for compatibility)
  // ---------------------------------------------------------------------------

  async playPcm16(arrayBuffer: ArrayBuffer): Promise<void> {
    const context = this.getContext();
    if (context.state === 'suspended') {
      await context.resume();
    }

    this.stop();

    const floatData = this.pcm16ToFloat32(arrayBuffer);
    const audioBuffer = context.createBuffer(1, floatData.length, 24000);
    audioBuffer.copyToChannel(floatData, 0);

    const sourceNode = context.createBufferSource();
    sourceNode.buffer = audioBuffer;
    sourceNode.connect(context.destination);
    this.sourceNode = sourceNode;

    await new Promise<void>((resolve) => {
      sourceNode.onended = () => {
        this.sourceNode = null;
        resolve();
      };
      sourceNode.start(0);
    });
  }

  // ---------------------------------------------------------------------------
  // Streaming playback — enqueue chunks as they arrive
  // ---------------------------------------------------------------------------

  /**
   * Schedule a PCM16 chunk for playback. Chunks are played back-to-back with
   * no gaps. Call this as each SSE chunk arrives for minimal time-to-audio.
   */
  async enqueue(chunk: ArrayBuffer): Promise<void> {
    if (chunk.byteLength === 0) return;

    const context = this.getContext();
    if (context.state === 'suspended') {
      await context.resume();
    }

    const floatData = this.pcm16ToFloat32(chunk);
    const audioBuffer = context.createBuffer(1, floatData.length, 24000);
    audioBuffer.copyToChannel(floatData, 0);

    const sourceNode = context.createBufferSource();
    sourceNode.buffer = audioBuffer;
    sourceNode.connect(context.destination);

    // Schedule seamlessly after the previous chunk
    const now = context.currentTime;
    const startAt = Math.max(now, this.nextStartTime);
    this.nextStartTime = startAt + audioBuffer.duration;

    this.pendingChunks += 1;

    if (!this.streamEndPromise) {
      this.streamEndPromise = new Promise<void>((resolve) => {
        this.streamEndResolve = resolve;
      });
    }

    sourceNode.onended = () => {
      this.pendingChunks -= 1;
      if (this.pendingChunks <= 0 && this.streamEndResolve) {
        this.streamEndResolve();
        this.streamEndPromise = null;
        this.streamEndResolve = null;
      }
    };

    sourceNode.start(startAt);
  }

  /**
   * Wait for all enqueued chunks to finish playing. Call after the last
   * `enqueue()` to know when playback is complete.
   */
  async flush(): Promise<void> {
    if (this.pendingChunks <= 0) return;
    await this.streamEndPromise;
    this.nextStartTime = 0;
  }

  stop() {
    if (!this.sourceNode) return;

    try {
      this.sourceNode.stop();
    } catch {
      // Ignore stop errors when source already ended.
    }

    this.sourceNode.onended = null;
    this.sourceNode.disconnect();
    this.sourceNode = null;

    // Reset streaming state
    this.pendingChunks = 0;
    this.nextStartTime = 0;
    if (this.streamEndResolve) {
      this.streamEndResolve();
      this.streamEndPromise = null;
      this.streamEndResolve = null;
    }
  }

  async dispose() {
    this.stop();
    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }
  }
}
