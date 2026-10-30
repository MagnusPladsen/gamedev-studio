"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { Play, Save, Download, Trash2, Shuffle, Dices, Volume2 } from "lucide-react";
import { v4 as uuid } from "uuid";
import { storage } from "@/lib/storage";
import type { SoundEffect, SfxParams } from "@/types";

const SAMPLE_RATE = 44100;

const DEFAULT_PARAMS: SfxParams = {
  waveType: "square",
  frequency: 440,
  frequencySlide: 0,
  repeatSpeed: 0,
  sustainTime: 0.15,
  decayTime: 0.3,
  attackTime: 0.01,
  hpFilterCutoff: 0,
  lpFilterCutoff: 1,
  lpFilterResonance: 0,
  volume: 0.7,
  vibratoDepth: 0,
  vibratoSpeed: 0,
};

const WAVE_TYPES: SfxParams["waveType"][] = ["square", "sawtooth", "sine", "triangle", "noise"];

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const PRESETS: Record<string, () => SfxParams> = {
  Pickup: () => ({
    ...DEFAULT_PARAMS,
    waveType: pick(["sine", "square"]),
    frequency: rand(500, 1200),
    frequencySlide: rand(0.1, 0.4),
    attackTime: 0,
    sustainTime: rand(0.05, 0.12),
    decayTime: rand(0.1, 0.3),
    volume: 0.6,
  }),
  Laser: () => ({
    ...DEFAULT_PARAMS,
    waveType: pick(["square", "sawtooth"]),
    frequency: rand(600, 1500),
    frequencySlide: rand(-0.5, -0.15),
    attackTime: 0,
    sustainTime: rand(0.05, 0.15),
    decayTime: rand(0.1, 0.25),
    volume: 0.5,
  }),
  Explosion: () => ({
    ...DEFAULT_PARAMS,
    waveType: "noise",
    frequency: rand(50, 200),
    frequencySlide: rand(-0.1, 0),
    attackTime: 0,
    sustainTime: rand(0.15, 0.35),
    decayTime: rand(0.3, 0.8),
    lpFilterCutoff: rand(0.2, 0.6),
    lpFilterResonance: rand(0, 0.3),
    volume: 0.8,
  }),
  Powerup: () => ({
    ...DEFAULT_PARAMS,
    waveType: pick(["square", "sawtooth"]),
    frequency: rand(300, 600),
    frequencySlide: rand(0.15, 0.5),
    attackTime: 0,
    sustainTime: rand(0.1, 0.2),
    decayTime: rand(0.2, 0.5),
    vibratoDepth: rand(0, 0.05),
    vibratoSpeed: rand(5, 15),
    repeatSpeed: rand(0.3, 0.6),
    volume: 0.6,
  }),
  Hit: () => ({
    ...DEFAULT_PARAMS,
    waveType: pick(["noise", "sawtooth"]),
    frequency: rand(100, 400),
    frequencySlide: rand(-0.3, -0.05),
    attackTime: 0,
    sustainTime: rand(0.02, 0.08),
    decayTime: rand(0.1, 0.3),
    hpFilterCutoff: rand(0, 0.2),
    volume: 0.7,
  }),
  Jump: () => ({
    ...DEFAULT_PARAMS,
    waveType: pick(["square", "sine"]),
    frequency: rand(200, 500),
    frequencySlide: rand(0.1, 0.35),
    attackTime: 0,
    sustainTime: rand(0.05, 0.15),
    decayTime: rand(0.1, 0.25),
    volume: 0.5,
  }),
  Blip: () => ({
    ...DEFAULT_PARAMS,
    waveType: pick(["sine", "square"]),
    frequency: rand(600, 1200),
    frequencySlide: 0,
    attackTime: 0,
    sustainTime: rand(0.03, 0.08),
    decayTime: rand(0.05, 0.12),
    volume: 0.4,
  }),
  Select: () => ({
    ...DEFAULT_PARAMS,
    waveType: "sine",
    frequency: rand(400, 800),
    frequencySlide: rand(0, 0.1),
    attackTime: 0,
    sustainTime: rand(0.04, 0.08),
    decayTime: rand(0.08, 0.15),
    volume: 0.35,
  }),
  Coin: () => ({
    ...DEFAULT_PARAMS,
    waveType: "square",
    frequency: rand(800, 1400),
    frequencySlide: rand(0.05, 0.2),
    attackTime: 0,
    sustainTime: rand(0.03, 0.07),
    decayTime: rand(0.1, 0.2),
    volume: 0.4,
  }),
};

const EXAMPLES: { name: string; params: SfxParams }[] = [
  {
    name: "Laser Beam",
    params: {
      waveType: "sawtooth",
      frequency: 1100,
      frequencySlide: -0.35,
      repeatSpeed: 0,
      sustainTime: 0.08,
      decayTime: 0.18,
      attackTime: 0,
      hpFilterCutoff: 0,
      lpFilterCutoff: 1,
      lpFilterResonance: 0,
      volume: 0.5,
      vibratoDepth: 0,
      vibratoSpeed: 0,
    },
  },
  {
    name: "Coin Collect",
    params: {
      waveType: "square",
      frequency: 900,
      frequencySlide: 0.15,
      repeatSpeed: 0,
      sustainTime: 0.05,
      decayTime: 0.15,
      attackTime: 0,
      hpFilterCutoff: 0,
      lpFilterCutoff: 1,
      lpFilterResonance: 0,
      volume: 0.4,
      vibratoDepth: 0,
      vibratoSpeed: 0,
    },
  },
  {
    name: "Boom",
    params: {
      waveType: "noise",
      frequency: 120,
      frequencySlide: -0.05,
      repeatSpeed: 0,
      sustainTime: 0.25,
      decayTime: 0.6,
      attackTime: 0,
      hpFilterCutoff: 0,
      lpFilterCutoff: 0.4,
      lpFilterResonance: 0.2,
      volume: 0.8,
      vibratoDepth: 0,
      vibratoSpeed: 0,
    },
  },
  {
    name: "Jump",
    params: {
      waveType: "square",
      frequency: 300,
      frequencySlide: 0.25,
      repeatSpeed: 0,
      sustainTime: 0.08,
      decayTime: 0.2,
      attackTime: 0,
      hpFilterCutoff: 0,
      lpFilterCutoff: 1,
      lpFilterResonance: 0,
      volume: 0.5,
      vibratoDepth: 0,
      vibratoSpeed: 0,
    },
  },
];

function synthesize(params: SfxParams): Float32Array {
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

function bufferToWav(buffer: Float32Array): ArrayBuffer {
  const numSamples = buffer.length;
  const bytesPerSample = 2;
  const dataSize = numSamples * bytesPerSample;
  const headerSize = 44;
  const arrayBuffer = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(arrayBuffer);

  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  writeString(0, "RIFF");
  view.setUint32(4, headerSize + dataSize - 8, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, buffer[i]));
    view.setInt16(headerSize + i * bytesPerSample, s * 0x7fff, true);
  }

  return arrayBuffer;
}

function playBuffer(buffer: Float32Array) {
  const ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
  const audioBuffer = ctx.createBuffer(1, buffer.length, SAMPLE_RATE);
  audioBuffer.getChannelData(0).set(buffer);
  const source = ctx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(ctx.destination);
  source.start();
  source.onended = () => ctx.close();
}

function drawWaveform(canvas: HTMLCanvasElement, buffer: Float32Array) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  ctx.fillStyle = "rgba(10,10,15,1)";
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = "rgba(42,42,58,0.5)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, h / 2);
  ctx.lineTo(w, h / 2);
  ctx.stroke();

  if (buffer.length === 0) return;

  ctx.strokeStyle = "#7c5cfc";
  ctx.lineWidth = 1.5;
  ctx.beginPath();

  const step = buffer.length / w;
  for (let i = 0; i < w; i++) {
    const idx = Math.floor(i * step);
    const val = buffer[idx] || 0;
    const y = (1 - val) * h / 2;
    if (i === 0) ctx.moveTo(i, y);
    else ctx.lineTo(i, y);
  }
  ctx.stroke();
}

export default function SfxPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [sfxParams, setSfxParams] = useState<SfxParams>({ ...DEFAULT_PARAMS });
  const [savedSounds, setSavedSounds] = useState<SoundEffect[]>([]);
  const [saveName, setSaveName] = useState("");
  const [currentBuffer, setCurrentBuffer] = useState<Float32Array>(new Float32Array(0));

  useEffect(() => {
    setSavedSounds(storage.getAll("sounds", projectId));
  }, [projectId]);

  useEffect(() => {
    if (canvasRef.current) {
      drawWaveform(canvasRef.current, currentBuffer);
    }
  }, [currentBuffer]);

  const generate = useCallback(() => {
    const buf = synthesize(sfxParams);
    setCurrentBuffer(buf);
    return buf;
  }, [sfxParams]);

  function playSound() {
    const buf = generate();
    playBuffer(buf);
  }

  function updateParam<K extends keyof SfxParams>(key: K, value: SfxParams[K]) {
    setSfxParams((p) => ({ ...p, [key]: value }));
  }

  function applyPreset(name: string) {
    const gen = PRESETS[name];
    if (gen) {
      const p = gen();
      setSfxParams(p);
      const buf = synthesize(p);
      setCurrentBuffer(buf);
      playBuffer(buf);
    }
  }

  function loadExample(ex: { name: string; params: SfxParams }) {
    setSfxParams({ ...ex.params });
    const buf = synthesize(ex.params);
    setCurrentBuffer(buf);
    playBuffer(buf);
    setSaveName(ex.name);
  }

  function randomize() {
    const presetNames = Object.keys(PRESETS);
    applyPreset(pick(presetNames));
  }

  function mutate() {
    setSfxParams((prev) => {
      const p = { ...prev };
      p.frequency = Math.max(20, p.frequency + rand(-100, 100));
      p.frequencySlide = Math.max(-1, Math.min(1, p.frequencySlide + rand(-0.1, 0.1)));
      p.sustainTime = Math.max(0.01, p.sustainTime + rand(-0.05, 0.05));
      p.decayTime = Math.max(0.01, p.decayTime + rand(-0.1, 0.1));
      p.lpFilterCutoff = Math.max(0, Math.min(1, p.lpFilterCutoff + rand(-0.1, 0.1)));
      p.vibratoDepth = Math.max(0, Math.min(1, p.vibratoDepth + rand(-0.02, 0.02)));
      const buf = synthesize(p);
      setCurrentBuffer(buf);
      playBuffer(buf);
      return p;
    });
  }

  function saveSound() {
    const name = saveName.trim() || "Untitled Sound";
    const sound: SoundEffect = {
      id: uuid(),
      projectId,
      name,
      params: { ...sfxParams },
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    storage.save("sounds", sound, projectId);
    setSavedSounds(storage.getAll("sounds", projectId));
    setSaveName("");
  }

  function deleteSound(id: string) {
    storage.delete("sounds", id, projectId);
    setSavedSounds(storage.getAll("sounds", projectId));
  }

  function playSaved(sound: SoundEffect) {
    const buf = synthesize(sound.params);
    playBuffer(buf);
  }

  function loadSaved(sound: SoundEffect) {
    setSfxParams({ ...sound.params });
    setSaveName(sound.name);
    const buf = synthesize(sound.params);
    setCurrentBuffer(buf);
    playBuffer(buf);
  }

  function exportWav() {
    const buf = generate();
    const wav = bufferToWav(buf);
    const blob = new Blob([wav], { type: "audio/wav" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${saveName.trim() || "sound"}.wav`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const sliderStyle: React.CSSProperties = {
    width: "100%",
    accentColor: "var(--accent)",
    cursor: "pointer",
  };

  const labelStyle: React.CSSProperties = {
    color: "var(--text-secondary)",
    fontSize: "0.75rem",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "2px",
  };

  return (
    <div className="p-4 md:p-6 h-full overflow-auto" style={{ background: "var(--bg-primary)" }}>
      <h1 className="text-xl font-bold mb-4" style={{ color: "var(--text-primary)" }}>
        SFX Generator
      </h1>

      <div className="flex flex-col lg:flex-row gap-4">
        {/* Left: Controls */}
        <div className="flex-1 space-y-4">
          {/* Waveform Display */}
          <div className="rounded-xl border p-3" style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}>
            <canvas
              ref={canvasRef}
              width={600}
              height={120}
              style={{ width: "100%", height: "120px", borderRadius: "8px" }}
            />
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={playSound}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium"
                style={{ background: "var(--accent)", color: "white" }}
              >
                <Play className="w-4 h-4" />
                Play
              </button>
              <button
                onClick={randomize}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm"
                style={{ background: "var(--bg-hover)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
              >
                <Shuffle className="w-4 h-4" />
                Randomize
              </button>
              <button
                onClick={mutate}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm"
                style={{ background: "var(--bg-hover)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
              >
                <Dices className="w-4 h-4" />
                Mutate
              </button>
              <button
                onClick={exportWav}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm"
                style={{ background: "var(--bg-hover)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
              >
                <Download className="w-4 h-4" />
                WAV
              </button>
            </div>
          </div>

          {/* Presets */}
          <div className="rounded-xl border p-3" style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}>
            <div className="text-xs font-medium mb-2" style={{ color: "var(--text-muted)" }}>
              PRESETS
            </div>
            <div className="flex flex-wrap gap-1.5">
              {Object.keys(PRESETS).map((name) => (
                <button
                  key={name}
                  onClick={() => applyPreset(name)}
                  className="px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
                  style={{ background: "var(--bg-hover)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>

          {/* Examples */}
          <div className="rounded-xl border p-3" style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}>
            <div className="text-xs font-medium mb-2" style={{ color: "var(--text-muted)" }}>
              EXAMPLES — click to load, tweak and make it yours
            </div>
            <div className="flex flex-wrap gap-1.5">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex.name}
                  onClick={() => loadExample(ex)}
                  className="px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
                  style={{ background: "var(--accent)", color: "white", opacity: 0.85 }}
                >
                  {ex.name}
                </button>
              ))}
            </div>
          </div>

          {/* Parameters */}
          <div className="rounded-xl border p-4 space-y-3" style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}>
            <div className="text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>
              PARAMETERS
            </div>

            {/* Wave Type */}
            <div>
              <div style={labelStyle}>
                <span>Wave Type</span>
                <span style={{ color: "var(--accent)" }}>{sfxParams.waveType}</span>
              </div>
              <div className="flex gap-1">
                {WAVE_TYPES.map((wt) => (
                  <button
                    key={wt}
                    onClick={() => updateParam("waveType", wt)}
                    className="flex-1 py-1.5 rounded-md text-xs font-medium transition-colors"
                    style={{
                      background: sfxParams.waveType === wt ? "var(--accent)" : "var(--bg-hover)",
                      color: sfxParams.waveType === wt ? "white" : "var(--text-secondary)",
                      border: `1px solid ${sfxParams.waveType === wt ? "var(--accent)" : "var(--border)"}`,
                    }}
                  >
                    {wt}
                  </button>
                ))}
              </div>
            </div>

            {/* Frequency */}
            <div>
              <div style={labelStyle}>
                <span>Frequency</span>
                <span style={{ color: "var(--text-muted)" }}>{sfxParams.frequency.toFixed(0)} Hz</span>
              </div>
              <input type="range" min="20" max="2400" step="1" value={sfxParams.frequency} onChange={(e) => updateParam("frequency", Number(e.target.value))} style={sliderStyle} />
            </div>

            <div>
              <div style={labelStyle}>
                <span>Frequency Slide</span>
                <span style={{ color: "var(--text-muted)" }}>{sfxParams.frequencySlide.toFixed(2)}</span>
              </div>
              <input type="range" min="-1" max="1" step="0.01" value={sfxParams.frequencySlide} onChange={(e) => updateParam("frequencySlide", Number(e.target.value))} style={sliderStyle} />
            </div>

            {/* Envelope */}
            <div>
              <div style={labelStyle}>
                <span>Attack Time</span>
                <span style={{ color: "var(--text-muted)" }}>{sfxParams.attackTime.toFixed(3)}s</span>
              </div>
              <input type="range" min="0" max="1" step="0.001" value={sfxParams.attackTime} onChange={(e) => updateParam("attackTime", Number(e.target.value))} style={sliderStyle} />
            </div>

            <div>
              <div style={labelStyle}>
                <span>Sustain Time</span>
                <span style={{ color: "var(--text-muted)" }}>{sfxParams.sustainTime.toFixed(3)}s</span>
              </div>
              <input type="range" min="0.01" max="1" step="0.001" value={sfxParams.sustainTime} onChange={(e) => updateParam("sustainTime", Number(e.target.value))} style={sliderStyle} />
            </div>

            <div>
              <div style={labelStyle}>
                <span>Decay Time</span>
                <span style={{ color: "var(--text-muted)" }}>{sfxParams.decayTime.toFixed(3)}s</span>
              </div>
              <input type="range" min="0.01" max="2" step="0.001" value={sfxParams.decayTime} onChange={(e) => updateParam("decayTime", Number(e.target.value))} style={sliderStyle} />
            </div>

            {/* Vibrato */}
            <div>
              <div style={labelStyle}>
                <span>Vibrato Depth</span>
                <span style={{ color: "var(--text-muted)" }}>{sfxParams.vibratoDepth.toFixed(3)}</span>
              </div>
              <input type="range" min="0" max="1" step="0.001" value={sfxParams.vibratoDepth} onChange={(e) => updateParam("vibratoDepth", Number(e.target.value))} style={sliderStyle} />
            </div>

            <div>
              <div style={labelStyle}>
                <span>Vibrato Speed</span>
                <span style={{ color: "var(--text-muted)" }}>{sfxParams.vibratoSpeed.toFixed(1)}</span>
              </div>
              <input type="range" min="0" max="50" step="0.1" value={sfxParams.vibratoSpeed} onChange={(e) => updateParam("vibratoSpeed", Number(e.target.value))} style={sliderStyle} />
            </div>

            {/* Filters */}
            <div>
              <div style={labelStyle}>
                <span>LP Filter Cutoff</span>
                <span style={{ color: "var(--text-muted)" }}>{sfxParams.lpFilterCutoff.toFixed(2)}</span>
              </div>
              <input type="range" min="0" max="1" step="0.01" value={sfxParams.lpFilterCutoff} onChange={(e) => updateParam("lpFilterCutoff", Number(e.target.value))} style={sliderStyle} />
            </div>

            <div>
              <div style={labelStyle}>
                <span>LP Filter Resonance</span>
                <span style={{ color: "var(--text-muted)" }}>{sfxParams.lpFilterResonance.toFixed(2)}</span>
              </div>
              <input type="range" min="0" max="1" step="0.01" value={sfxParams.lpFilterResonance} onChange={(e) => updateParam("lpFilterResonance", Number(e.target.value))} style={sliderStyle} />
            </div>

            <div>
              <div style={labelStyle}>
                <span>HP Filter Cutoff</span>
                <span style={{ color: "var(--text-muted)" }}>{sfxParams.hpFilterCutoff.toFixed(2)}</span>
              </div>
              <input type="range" min="0" max="1" step="0.01" value={sfxParams.hpFilterCutoff} onChange={(e) => updateParam("hpFilterCutoff", Number(e.target.value))} style={sliderStyle} />
            </div>

            {/* Volume & Repeat */}
            <div>
              <div style={labelStyle}>
                <span>Volume</span>
                <span style={{ color: "var(--text-muted)" }}>{sfxParams.volume.toFixed(2)}</span>
              </div>
              <input type="range" min="0" max="1" step="0.01" value={sfxParams.volume} onChange={(e) => updateParam("volume", Number(e.target.value))} style={sliderStyle} />
            </div>

            <div>
              <div style={labelStyle}>
                <span>Repeat Speed</span>
                <span style={{ color: "var(--text-muted)" }}>{sfxParams.repeatSpeed.toFixed(2)}</span>
              </div>
              <input type="range" min="0" max="1" step="0.01" value={sfxParams.repeatSpeed} onChange={(e) => updateParam("repeatSpeed", Number(e.target.value))} style={sliderStyle} />
            </div>
          </div>
        </div>

        {/* Right: Save & Saved Sounds */}
        <div className="w-full lg:w-72 space-y-4">
          {/* Save */}
          <div className="rounded-xl border p-3" style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}>
            <div className="text-xs font-medium mb-2" style={{ color: "var(--text-muted)" }}>
              SAVE TO PROJECT
            </div>
            <input
              type="text"
              placeholder="Sound name"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg text-sm mb-2 outline-none"
              style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
              onKeyDown={(e) => e.key === "Enter" && saveSound()}
            />
            <button
              onClick={saveSound}
              className="flex items-center gap-1.5 w-full justify-center px-3 py-1.5 rounded-lg text-sm font-medium"
              style={{ background: "var(--accent)", color: "white" }}
            >
              <Save className="w-4 h-4" />
              Save Sound
            </button>
          </div>

          {/* Saved List */}
          <div className="rounded-xl border p-3" style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}>
            <div className="text-xs font-medium mb-2" style={{ color: "var(--text-muted)" }}>
              SAVED SOUNDS ({savedSounds.length})
            </div>
            {savedSounds.length === 0 ? (
              <p className="text-xs py-4 text-center" style={{ color: "var(--text-muted)" }}>
                No sounds saved yet
              </p>
            ) : (
              <div className="space-y-1 max-h-96 overflow-y-auto">
                {savedSounds.map((sound) => (
                  <div
                    key={sound.id}
                    className="group flex items-center justify-between p-2 rounded-lg transition-colors cursor-pointer"
                    style={{ background: "transparent" }}
                    onClick={() => loadSaved(sound)}
                    onMouseOver={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
                    onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Volume2 className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--yellow)" }} />
                      <span className="text-xs truncate" style={{ color: "var(--text-primary)" }}>
                        {sound.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          playSaved(sound);
                        }}
                        className="p-1 rounded"
                        style={{ color: "var(--green)" }}
                      >
                        <Play className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteSound(sound.id);
                        }}
                        className="p-1 rounded"
                        style={{ color: "var(--red)" }}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Free notice */}
          <div className="rounded-xl border p-3" style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}>
            <div className="flex items-center gap-2 mb-1">
              <Download className="w-4 h-4" style={{ color: "var(--green)" }} />
              <span className="text-xs font-medium" style={{ color: "var(--green)" }}>
                Free Downloads
              </span>
            </div>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              All sounds are yours. Export as WAV with no watermarks, no sign-up, no limits.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
