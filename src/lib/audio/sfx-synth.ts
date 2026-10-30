import type { SfxParams } from "@/types";

export const SAMPLE_RATE = 44100;

export function synthesize(params: SfxParams): Float32Array {
  const totalTime = params.attackTime + params.sustainTime + params.decayTime;
  const numSamples = Math.ceil(totalTime * SAMPLE_RATE);
  const buffer = new Float32Array(numSamples);

  let phase = 0;
  let noiseBuffer: Float32Array | null = null;
  if (params.waveType === "noise") {
    noiseBuffer = new Float32Array(32);
    for (let i = 0; i < 32; i++) noiseBuffer[i] = Math.random() * 2 - 1;
  }

  let lpFilterPos = 0;
  let lpFilterDeltaPos = 0;

  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;

    let envelope = 1;
    if (t < params.attackTime) {
      envelope = params.attackTime > 0 ? t / params.attackTime : 1;
    } else if (t < params.attackTime + params.sustainTime) {
      envelope = 1;
    } else {
      const decayT = t - params.attackTime - params.sustainTime;
      envelope = params.decayTime > 0 ? 1 - decayT / params.decayTime : 0;
    }
    envelope = Math.max(0, Math.min(1, envelope));

    const slideOffset = params.frequencySlide * t * 1000;
    let freq = params.frequency + slideOffset;
    freq = Math.max(1, freq);

    if (params.vibratoDepth > 0) {
      freq += Math.sin(t * params.vibratoSpeed * Math.PI * 2) * params.vibratoDepth * freq;
    }

    const period = SAMPLE_RATE / freq;
    phase += 1;
    if (params.repeatSpeed > 0 && phase > period * params.repeatSpeed * 100) {
      phase = 0;
    }

    let sample = 0;
    const phaseNorm = (phase % period) / period;

    switch (params.waveType) {
      case "square":
        sample = phaseNorm < 0.5 ? 1 : -1;
        break;
      case "sawtooth":
        sample = 2 * phaseNorm - 1;
        break;
      case "sine":
        sample = Math.sin(phaseNorm * Math.PI * 2);
        break;
      case "triangle":
        sample = phaseNorm < 0.5 ? 4 * phaseNorm - 1 : 3 - 4 * phaseNorm;
        break;
      case "noise":
        sample = noiseBuffer![Math.floor(phase) % 32];
        if (Math.random() < freq / SAMPLE_RATE) {
          noiseBuffer![Math.floor(Math.random() * 32)] = Math.random() * 2 - 1;
        }
        break;
    }

    if (params.lpFilterCutoff < 1) {
      const cutoff = Math.pow(params.lpFilterCutoff, 3) * 0.1;
      lpFilterDeltaPos += (sample - lpFilterPos) * cutoff;
      lpFilterDeltaPos *= 1 - (0.5 + params.lpFilterResonance * 0.45);
      lpFilterPos += lpFilterDeltaPos;
      sample = lpFilterPos;
    }

    if (params.hpFilterCutoff > 0) {
      const hpCutoff = Math.pow(params.hpFilterCutoff, 2) * 0.1;
      sample -= sample * hpCutoff;
    }

    buffer[i] = sample * envelope * params.volume;
  }

  return buffer;
}
