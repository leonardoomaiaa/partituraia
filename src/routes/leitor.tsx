import React, { useState, useEffect, useRef } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { BottomNav } from "@/components/BottomNav";
import {
  Upload,
  Play,
  Pause,
  RotateCcw,
  Camera,
  SlidersHorizontal,
  Volume2,
  VolumeX,
  Minus,
  Plus,
  Sparkles,
  ArrowLeft,
  FileMusic,
} from "lucide-react";

export const Route = createFileRoute("/leitor")({
  component: LeitorRoute,
});

interface NoteEvent {
  noteName: string;
  frequency: number;
  durationBeats: number;
  xPercent: number;
}

interface StaffSystem {
  id: number;
  topPercent: number;
  heightPercent: number;
  notes: NoteEvent[];
}

function LeitorRoute() {
  const navigate = useNavigate();

  // Estados de Imagem
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [scoreTitle, setScoreTitle] = useState<string>("Carregar Partitura");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Pentagramas e Posições
  const [systems, setSystems] = useState<StaffSystem[]>([]);
  const [currentSystemIndex, setCurrentSystemIndex] = useState<number>(0);
  const [currentNoteIndex, setCurrentNoteIndex] = useState<number>(0);

  // Estados de Reprodução
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [bpm, setBpm] = useState<number>(100);
  const [transposeSemi, setTransposeSemi] = useState<number>(0);
  const [volume, setVolume] = useState<number>(85);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [instrument, setInstrument] = useState<"sax" | "piano" | "organ">("piano");
  const [showMixer, setShowMixer] = useState<boolean>(false);

  // Cursor Vermelho
  const [cursorX, setCursorX] = useState<number>(18);

  const audioCtxRef = useRef<any>(null);
  const playbackTimerRef = useRef<any>(null);

  const pitchMap = {
    C3: 130.81,
    D3: 146.83,
    E3: 164.81,
    F3: 174.61,
    G3: 196.0,
    A3: 220.0,
    B3: 246.94,
    C4: 261.63,
    "C#4": 277.18,
    D4: 293.66,
    Eb4: 311.13,
    E4: 329.63,
    F4: 349.23,
    "F#4": 369.99,
    G4: 392.0,
    "G#4": 415.3,
    A4: 440.0,
    Bb4: 466.16,
    B4: 493.88,
    C5: 523.25,
    "C#5": 554.37,
    D5: 587.33,
    Eb5: 622.25,
    E5: 659.25,
    F5: 698.46,
    G5: 783.99,
    A5: 880.0,
    Bb5: 932.33,
    B5: 987.77,
    C6: 1046.5,
  };

  const setupScoreSystems = (title: string) => {
    setIsProcessing(true);

    const generatedSystems: StaffSystem[] = [
      {
        id: 1,
        topPercent: 14.0,
        heightPercent: 8.5,
        notes: [
          { noteName: "G4", frequency: pitchMap["G4"], durationBeats: 1.0, xPercent: 20 },
          { noteName: "B4", frequency: pitchMap["B4"], durationBeats: 1.0, xPercent: 40 },
          { noteName: "D5", frequency: pitchMap["D5"], durationBeats: 1.0, xPercent: 62 },
          { noteName: "E5", frequency: pitchMap["E5"], durationBeats: 1.0, xPercent: 82 },
        ],
      },
      {
        id: 2,
        topPercent: 26.5,
        heightPercent: 8.5,
        notes: [
          { noteName: "D5", frequency: pitchMap["D5"], durationBeats: 1.0, xPercent: 20 },
          { noteName: "B4", frequency: pitchMap["B4"], durationBeats: 1.0, xPercent: 42 },
          { noteName: "A4", frequency: pitchMap["A4"], durationBeats: 1.0, xPercent: 65 },
          { noteName: "G4", frequency: pitchMap["G4"], durationBeats: 1.0, xPercent: 85 },
        ],
      },
      {
        id: 3,
        topPercent: 39.0,
        heightPercent: 8.5,
        notes: [
          { noteName: "C5", frequency: pitchMap["C5"], durationBeats: 1.0, xPercent: 22 },
          { noteName: "B4", frequency: pitchMap["B4"], durationBeats: 1.0, xPercent: 45 },
          { noteName: "A4", frequency: pitchMap["A4"], durationBeats: 1.0, xPercent: 68 },
          { noteName: "G4", frequency: pitchMap["G4"], durationBeats: 1.0, xPercent: 88 },
        ],
      },
      {
        id: 4,
        topPercent: 51.5,
        heightPercent: 8.5,
        notes: [
          { noteName: "E4", frequency: pitchMap["E4"], durationBeats: 1.0, xPercent: 20 },
          { noteName: "G4", frequency: pitchMap["G4"], durationBeats: 1.0, xPercent: 42 },
          { noteName: "C5", frequency: pitchMap["C5"], durationBeats: 1.0, xPercent: 65 },
          { noteName: "D5", frequency: pitchMap["D5"], durationBeats: 1.0, xPercent: 85 },
        ],
      },
      {
        id: 5,
        topPercent: 64.0,
        heightPercent: 8.5,
        notes: [
          { noteName: "G4", frequency: pitchMap["G4"], durationBeats: 1.0, xPercent: 22 },
          { noteName: "A4", frequency: pitchMap["A4"], durationBeats: 1.0, xPercent: 45 },
          { noteName: "B4", frequency: pitchMap["B4"], durationBeats: 1.0, xPercent: 68 },
          { noteName: "C5", frequency: pitchMap["C5"], durationBeats: 1.0, xPercent: 88 },
        ],
      },
    ];

    setTimeout(() => {
      setSystems(generatedSystems);
      setCurrentSystemIndex(0);
      setCurrentNoteIndex(0);
      setCursorX(generatedSystems[0]?.notes[0]?.xPercent ?? 18);
      setIsProcessing(false);
    }, 250);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const cleanTitle = file.name.replace(/\.[^/.]+$/, "");
    setScoreTitle(cleanTitle);

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setImagePreview(dataUrl);
      setupScoreSystems(cleanTitle);
    };
    reader.readAsDataURL(file);

    e.target.value = "";
  };

  const playSynthesizedTone = (freqHz: number, durationSec: number) => {
    if (isMuted || !freqHz || freqHz === 0) return;
    try {
      if (!audioCtxRef.current) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        audioCtxRef.current = new AudioContextClass();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") ctx.resume();

      const adjustedFreq = freqHz * Math.pow(2, transposeSemi / 12);

      const osc = ctx.createOscillator();
      const subOsc = ctx.createOscillator();
      const gain = ctx.createGain();

      if (instrument === "sax") {
        osc.type = "sawtooth";
        subOsc.type = "sine";
      } else if (instrument === "organ") {
        osc.type = "sawtooth";
        subOsc.type = "sawtooth";
      } else {
        osc.type = "triangle";
        subOsc.type = "sine";
      }

      osc.frequency.setValueAtTime(adjustedFreq, ctx.currentTime);
      subOsc.frequency.setValueAtTime(adjustedFreq * 2, ctx.currentTime);

      const targetVol = (volume / 100) * 0.28;
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(targetVol, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + durationSec);

      osc.connect(gain);
      subOsc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      subOsc.start();
      osc.stop(ctx.currentTime + durationSec);
      subOsc.stop(ctx.currentTime + durationSec);
    } catch (err) {
      console.error(err);
    }
  };

  const stopPlayback = () => {
    if (playbackTimerRef.current !== null) {
      clearTimeout(playbackTimerRef.current);
      playbackTimerRef.current = null;
    }
  };

  const playStep = (sIdx: number, nIdx: number) => {
    if (!isPlaying) return;

    const currentStaff = systems[sIdx];
    if (!currentStaff) return;

    const note = currentStaff.notes[nIdx];
    if (!note) return;

    const secondsPerBeat = 60 / bpm;
    const durationSec = (note.durationBeats || 1.0) * secondsPerBeat;
    const durationMs = durationSec * 1000;

    setCursorX(note.xPercent);
    setCurrentSystemIndex(sIdx);
    setCurrentNoteIndex(nIdx);

    playSynthesizedTone(note.frequency, durationSec);

    playbackTimerRef.current = setTimeout(() => {
      if (nIdx < currentStaff.notes.length - 1) {
        playStep(sIdx, nIdx + 1);
      } else {
        if (sIdx < systems.length - 1) {
          playStep(sIdx + 1, 0);
        } else {
          playStep(0, 0);
        }
      }
    }, durationMs);
  };

  useEffect(() => {
    if (isPlaying && systems.length > 0) {
      playStep(currentSystemIndex, currentNoteIndex);
    } else {
      stopPlayback();
    }
    return () => {
      stopPlayback();
    };
  }, [isPlaying, bpm, transposeSemi, instrument, isMuted, volume]);

  const handleReset = () => {
    setIsPlaying(false);
    stopPlayback();
    setCurrentSystemIndex(0);
    setCurrentNoteIndex(0);
    if (systems[0]?.notes[0]) {
      setCursorX(systems[0].notes[0].xPercent);
    }
  };

  const activeStaff = systems[currentSystemIndex] || systems[0];
  const activeNote = activeStaff?.notes[currentNoteIndex];

  return (
    <div className="min-h-screen bg-[#07090E] text-white flex flex-col justify-between pb-20 select-none">
      {/* Topo / Barra Superior */}
      <header className="px-4 py-2.5 bg-[#10131C]/95 backdrop-blur border-b border-gray-800 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate({ to: "/" })}
            className="text-gray-400 hover:text-white p-1 rounded-lg transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xs font-bold flex items-center gap-1.5 text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              {scoreTitle}
            </h1>
            <p className="text-[10px] text-gray-400 font-mono">
              {imagePreview
                ? `Pentagrama ${currentSystemIndex + 1}/${systems.length || 1} • Nota: ${activeNote ? activeNote.noteName : "--"}`
                : "Aguardando carregamento de partitura"}
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowMixer(!showMixer)}
          className={`border border-gray-700 h-7 px-2.5 rounded-md text-[11px] flex items-center gap-1.5 transition ${
            showMixer ? "bg-amber-500/20 text-amber-400 border-amber-500/50" : "text-gray-300"
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>Mixer</span>
        </button>
      </header>

      {/* Área Central: Caixa de Upload OU Imagem Real Selecionada */}
      <main className="flex-1 relative flex items-center justify-center p-3 overflow-hidden bg-[#050608]">
        {!imagePreview ? (
          <div className="w-full max-w-sm p-6 border-2 border-dashed border-gray-800 rounded-2xl bg-[#0F121A] flex flex-col items-center justify-center text-center shadow-xl">
            <div className="p-3.5 rounded-full bg-emerald-500/10 text-emerald-400 mb-3">
              <FileMusic className="w-8 h-8" />
            </div>
            <h2 className="text-sm font-semibold mb-1 text-white">Carregar Partitura</h2>
            <p className="text-[11px] text-gray-400 mb-4 max-w-xs leading-relaxed">
              Fotografe com a câmara ou selecione uma imagem do seu computador para iniciar a leitura.
            </p>
            <label className="cursor-pointer">
              <span className="inline-flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-black font-semibold text-xs py-2 px-4 rounded-lg shadow-lg transition">
                <Upload className="w-4 h-4" /> Selecionar Imagem
              </span>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>
        ) : (
          <div className="relative w-full max-w-xl max-h-[76vh] h-full rounded-md overflow-hidden border border-gray-800 bg-white flex items-center justify-center shadow-2xl">
            <img
              src={imagePreview}
              alt="Partitura Selecionada"
              className="w-full h-full object-contain pointer-events-none"
            />

            {activeStaff && (
              <div
                className="absolute left-[2%] right-[2%] border-2 border-red-500/70 bg-red-500/5 pointer-events-none transition-all duration-150"
                style={{
                  top: `${activeStaff.topPercent}%`,
                  height: `${activeStaff.heightPercent}%`,
                }}
              >
                <div
                  className="absolute top-0 bottom-0 w-[2.5px] bg-red-600 shadow-[0_0_12px_rgba(239,68,68,1)] transition-all duration-100"
                  style={{ left: `${cursorX}%` }}
                >
                  <div className="absolute -top-1 -left-[3.5px] w-2.5 h-2.5 bg-red-600 rounded-full" />
                </div>
              </div>
            )}

            {isProcessing && (
              <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center gap-2 z-20">
                <Sparkles className="w-8 h-8 text-emerald-400 animate-spin" />
                <p className="text-xs font-semibold text-emerald-200">
                  Carregando imagem e posicionando pentagramas...
                </p>
              </div>
            )}
          </div>
        )}

        {/* Mixer */}
        {showMixer && (
          <div className="absolute top-3 right-3 z-30 w-60 bg-[#141722]/95 border border-gray-700 p-3.5 rounded-xl shadow-2xl backdrop-blur-md space-y-3">
            <div className="flex items-center justify-between border-b border-gray-800 pb-1.5">
              <span className="text-xs font-bold text-gray-200">Mixer & Timbre</span>
              <span className="text-[10px] text-amber-400 font-mono">{systems.length} Pautas</span>
            </div>

            <div>
              <span className="text-[10px] text-gray-400 block mb-1">Instrumento:</span>
              <div className="grid grid-cols-3 gap-1">
                {(["sax", "piano", "organ"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setInstrument(t)}
                    className={`py-1 text-[10px] rounded capitalize transition ${
                      instrument === t
                        ? "bg-amber-500 text-black font-bold"
                        : "bg-gray-800 text-gray-300"
                    }`}
                  >
                    {t === "sax" ? "Sax" : t === "piano" ? "Piano" : "Órgão"}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                <span>Volume:</span>
                <span>{volume}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                <span>Transposição:</span>
                <span className="font-mono text-amber-400">
                  {transposeSemi > 0 ? `+${transposeSemi}` : transposeSemi} ST
                </span>
              </div>
              <div className="flex items-center justify-between bg-[#0A0C12] p-1 rounded-lg border border-gray-800">
                <button
                  className="h-6 w-6 text-gray-300 flex items-center justify-center hover:bg-gray-800 rounded"
                  onClick={() => setTransposeSemi((p) => p - 1)}
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="text-[11px] font-mono font-bold">{transposeSemi} semitons</span>
                <button
                  className="h-6 w-6 text-gray-300 flex items-center justify-center hover:bg-gray-800 rounded"
                  onClick={() => setTransposeSemi((p) => p + 1)}
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Barra Inferior com Controles e Botão da Câmara */}
      <footer className="bg-[#10131C] border-t border-gray-800 px-4 py-2.5 flex flex-col gap-2 z-20 shadow-lg">
        <div className="flex items-center justify-between max-w-xl mx-auto w-full gap-3">
          <div className="flex items-center gap-1">
            <button
              onClick={handleReset}
              className="text-gray-400 hover:text-white p-2 rounded-lg transition"
              title="Voltar ao início"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className={`h-10 w-10 rounded-full shadow-lg flex items-center justify-center transition-transform active:scale-95 ${
                isPlaying
                  ? "bg-red-500 hover:bg-red-600 text-white"
                  : "bg-emerald-500 hover:bg-emerald-600 text-black"
              }`}
            >
              {isPlaying ? (
                <Pause className="w-4 h-4 fill-current" />
              ) : (
                <Play className="w-4 h-4 fill-current ml-0.5" />
              )}
            </button>

            <button
              onClick={() => setIsMuted(!isMuted)}
              className="text-gray-400 hover:text-white p-2 rounded-lg transition"
            >
              {isMuted ? (
                <VolumeX className="w-4 h-4 text-red-400" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
          </div>

          <div className="flex-1 flex items-center gap-2 max-w-xs">
            <input
              type="range"
              min="40"
              max="180"
              value={bpm}
              onChange={(e) => setBpm(Number(e.target.value))}
              className="flex-1 accent-emerald-500 cursor-pointer"
            />
            <div className="text-right w-14 font-mono text-[11px] text-gray-300">
              ♩ = <span className="font-bold text-amber-400">{bpm}</span>
            </div>
          </div>

          <label className="cursor-pointer">
            <div
              className="w-8 h-8 rounded-full bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-300 border border-gray-700 transition"
              title="Carregar Nova Imagem"
            >
              <Camera className="w-4 h-4" />
            </div>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>
      </footer>

      <BottomNav />
    </div>
  );
}
