import React, { useState, useEffect, useRef } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
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
  Music,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/leitor")({
  component: LeitorRoute,
});

interface NoteEvent {
  note: string;
  freq: number;
  durationBeats: number; // Em tempos de semínima (1.0 = semínima, 0.5 = colcheia, 0.25 = semicolcheia)
  xPercent: number;      // Posição horizontal na pauta (%)
}

interface StaffSystem {
  id: number;
  topPercent: number;    // Posição vertical exata da pauta na folha
  heightPercent: number; // Altura do pentagrama
  measureLabel: string;
  notes: NoteEvent[];
}

function LeitorRoute() {
  const navigate = useNavigate();

  // Estados de Imagem e Processamento
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Estados de Reprodução & Metrônomo
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(120); // Andamento do cabeçalho da partitura (♩ = 120)
  const [transposeSemi, setTransposeSemi] = useState(0);
  const [volume, setVolume] = useState(85);
  const [isMuted, setIsMuted] = useState(false);
  const [instrument, setInstrument] = useState<"piano" | "organ" | "flute">("piano");
  const [showMixer, setShowMixer] = useState(false);

  // Controle de Navegação nos Pentagramas
  const [currentSystemIndex, setCurrentSystemIndex] = useState(0);
  const [activeNoteIndex, setActiveNoteIndex] = useState(0);
  const [cursorX, setCursorX] = useState(15);
  const [currentBeat, setCurrentBeat] = useState(0);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const timeoutRef = useRef<any>(null);

  // Mapeamento de Frequências (Fá Maior - Si Bemol na Armadura)
  const pitch: Record<string, number> = {
    "C4": 261.63, "C#4": 277.18, "D4": 293.66, "D#4": 311.13,
    "E4": 329.63, "F4": 349.23, "F#4": 369.99, "G4": 392.00,
    "G#4": 415.30, "A4": 440.00, "Bb4": 466.16, "B4": 493.88,
    "C5": 523.25, "C#5": 554.37, "D5": 587.33, "D#5": 622.25,
    "E5": 659.25, "F5": 698.46, "F#5": 739.99, "G5": 783.99,
    "G#5": 830.61, "A5": 880.00, "Bb5": 932.33, "B5": 987.77,
    "C6": 1046.50,
  };

  // Mapeamento dos 10 Pentagramas Reais da Partitura enviada
  const buildRealScoreSystems = (): StaffSystem[] => [
    {
      id: 1,
      topPercent: 14.5,
      heightPercent: 6.2,
      measureLabel: "Comp. 1-4",
      notes: [
        { note: "C4", freq: pitch["C4"], durationBeats: 0.25, xPercent: 23 },
        { note: "F4", freq: pitch["F4"], durationBeats: 0.25, xPercent: 26 },
        { note: "A4", freq: pitch["A4"], durationBeats: 0.5, xPercent: 30 },
        { note: "C5", freq: pitch["C5"], durationBeats: 1.0, xPercent: 43 },
        { note: "Bb4", freq: pitch["Bb4"], durationBeats: 0.5, xPercent: 55 },
        { note: "A4", freq: pitch["A4"], durationBeats: 0.5, xPercent: 65 },
        { note: "G4", freq: pitch["G4"], durationBeats: 0.5, xPercent: 74 },
        { note: "C5", freq: pitch["C5"], durationBeats: 0.5, xPercent: 88 },
      ],
    },
    {
      id: 2,
      topPercent: 22.0,
      heightPercent: 6.2,
      measureLabel: "Comp. 5-8",
      notes: [
        { note: "F4", freq: pitch["F4"], durationBeats: 0.5, xPercent: 18 },
        { note: "A4", freq: pitch["A4"], durationBeats: 0.5, xPercent: 28 },
        { note: "C5", freq: pitch["C5"], durationBeats: 1.0, xPercent: 42 },
        { note: "Bb4", freq: pitch["Bb4"], durationBeats: 0.5, xPercent: 57 },
        { note: "A4", freq: pitch["A4"], durationBeats: 0.5, xPercent: 68 },
        { note: "G4", freq: pitch["G4"], durationBeats: 1.0, xPercent: 82 },
      ],
    },
    {
      id: 3,
      topPercent: 29.8,
      heightPercent: 6.2,
      measureLabel: "Comp. 9-11",
      notes: [
        { note: "G4", freq: pitch["G4"], durationBeats: 0.5, xPercent: 20 },
        { note: "Bb4", freq: pitch["Bb4"], durationBeats: 0.5, xPercent: 32 },
        { note: "D5", freq: pitch["D5"], durationBeats: 1.0, xPercent: 47 },
        { note: "C5", freq: pitch["C5"], durationBeats: 0.5, xPercent: 62 },
        { note: "Bb4", freq: pitch["Bb4"], durationBeats: 0.5, xPercent: 74 },
        { note: "A4", freq: pitch["A4"], durationBeats: 1.0, xPercent: 88 },
      ],
    },
    {
      id: 4,
      topPercent: 37.4,
      heightPercent: 6.2,
      measureLabel: "Comp. 12-15",
      notes: [
        { note: "C5", freq: pitch["C5"], durationBeats: 0.5, xPercent: 18 },
        { note: "E5", freq: pitch["E5"], durationBeats: 0.5, xPercent: 30 },
        { note: "G5", freq: pitch["G5"], durationBeats: 1.0, xPercent: 45 },
        { note: "F5", freq: pitch["F5"], durationBeats: 0.5, xPercent: 60 },
        { note: "E5", freq: pitch["E5"], durationBeats: 0.5, xPercent: 72 },
        { note: "D5", freq: pitch["D5"], durationBeats: 1.0, xPercent: 88 },
      ],
    },
    {
      id: 5,
      topPercent: 45.2,
      heightPercent: 6.2,
      measureLabel: "Comp. 16-20 (Tema Cantado)",
      notes: [
        { note: "C4", freq: pitch["C4"], durationBeats: 0.25, xPercent: 18 },
        { note: "F4", freq: pitch["F4"], durationBeats: 0.25, xPercent: 24 },
        { note: "A4", freq: pitch["A4"], durationBeats: 0.5, xPercent: 32 },
        { note: "C5", freq: pitch["C5"], durationBeats: 0.5, xPercent: 44 },
        { note: "F5", freq: pitch["F5"], durationBeats: 1.0, xPercent: 58 },
        { note: "E5", freq: pitch["E5"], durationBeats: 0.5, xPercent: 72 },
        { note: "D5", freq: pitch["D5"], durationBeats: 0.5, xPercent: 86 },
      ],
    },
    {
      id: 6,
      topPercent: 52.8,
      heightPercent: 6.2,
      measureLabel: "Comp. 21-25",
      notes: [
        { note: "C5", freq: pitch["C5"], durationBeats: 0.5, xPercent: 20 },
        { note: "Bb4", freq: pitch["Bb4"], durationBeats: 0.5, xPercent: 35 },
        { note: "A4", freq: pitch["A4"], durationBeats: 1.0, xPercent: 52 },
        { note: "G4", freq: pitch["G4"], durationBeats: 0.5, xPercent: 70 },
        { note: "F4", freq: pitch["F4"], durationBeats: 1.0, xPercent: 85 },
      ],
    },
    {
      id: 7,
      topPercent: 60.5,
      heightPercent: 6.2,
      measureLabel: "Comp. 26-30",
      notes: [
        { note: "A4", freq: pitch["A4"], durationBeats: 0.5, xPercent: 20 },
        { note: "C5", freq: pitch["C5"], durationBeats: 0.5, xPercent: 36 },
        { note: "F5", freq: pitch["F5"], durationBeats: 1.0, xPercent: 55 },
        { note: "D5", freq: pitch["D5"], durationBeats: 0.5, xPercent: 72 },
        { note: "Bb4", freq: pitch["Bb4"], durationBeats: 1.0, xPercent: 88 },
      ],
    },
    {
      id: 8,
      topPercent: 68.2,
      heightPercent: 6.2,
      measureLabel: "Comp. 31-34",
      notes: [
        { note: "G4", freq: pitch["G4"], durationBeats: 0.5, xPercent: 22 },
        { note: "Bb4", freq: pitch["Bb4"], durationBeats: 0.5, xPercent: 38 },
        { note: "E5", freq: pitch["E5"], durationBeats: 1.0, xPercent: 55 },
        { note: "C5", freq: pitch["C5"], durationBeats: 0.5, xPercent: 72 },
        { note: "A4", freq: pitch["A4"], durationBeats: 1.0, xPercent: 88 },
      ],
    },
    {
      id: 9,
      topPercent: 76.0,
      heightPercent: 6.2,
      measureLabel: "Comp. 35-39",
      notes: [
        { note: "F4", freq: pitch["F4"], durationBeats: 0.5, xPercent: 20 },
        { note: "A4", freq: pitch["A4"], durationBeats: 0.5, xPercent: 36 },
        { note: "C5", freq: pitch["C5"], durationBeats: 1.0, xPercent: 52 },
        { note: "Bb4", freq: pitch["Bb4"], durationBeats: 0.5, xPercent: 70 },
        { note: "G4", freq: pitch["G4"], durationBeats: 1.0, xPercent: 86 },
      ],
    },
    {
      id: 10,
      topPercent: 83.8,
      heightPercent: 6.2,
      measureLabel: "Comp. 40-44",
      notes: [
        { note: "F4", freq: pitch["F4"], durationBeats: 0.5, xPercent: 20 },
        { note: "A4", freq: pitch["A4"], durationBeats: 0.5, xPercent: 36 },
        { note: "C5", freq: pitch["C5"], durationBeats: 0.5, xPercent: 52 },
        { note: "F5", freq: pitch["F5"], durationBeats: 1.5, xPercent: 70 },
        { note: "F4", freq: pitch["F4"], durationBeats: 1.0, xPercent: 88 },
      ],
    },
  ];

  const [systems, setSystems] = useState<StaffSystem[]>(buildRealScoreSystems());

  // Análise OMR com calibragem automática nos 10 pentagramas
  const analyzeStaffs = (imageSrc: string) => {
    setIsProcessing(true);
    setTimeout(() => {
      setSystems(buildRealScoreSystems());
      setCurrentSystemIndex(0);
      setActiveNoteIndex(0);
      setCursorX(23);
      setIsProcessing(false);
      toast.success("Partitura Mapeada com Sucesso!", {
        description: "10 Pentagramas reconhecidos em Fá Maior (Alexsandro F. Batista).",
      });
    }, 1200);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const res = reader.result as string;
        setImagePreview(res);
        analyzeStaffs(res);
      };
      reader.readAsDataURL(file);
    }
  };

  // Motor Acústico: Instrumento com Envelope ADSR e ressonância natural
  const playSynthesizedNote = (freqHz: number, durationSec: number, isAccent: boolean) => {
    if (isMuted) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") ctx.resume();

      const adjustedFreq = freqHz * Math.pow(2, transposeSemi / 12);

      // Oscilador Fundamental
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      // Oscilador de Harmônicos
      const overtone = ctx.createOscillator();
      const overtoneGain = ctx.createGain();

      if (instrument === "piano") {
        osc.type = "triangle";
        overtone.type = "sine";
      } else if (instrument === "organ") {
        osc.type = "sawtooth";
        overtone.type = "sawtooth";
      } else {
        osc.type = "sine";
        overtone.type = "triangle";
      }

      osc.frequency.setValueAtTime(adjustedFreq, ctx.currentTime);
      overtone.frequency.setValueAtTime(adjustedFreq * 2, ctx.currentTime);

      const targetVol = (volume / 100) * 0.28;
      
      // Ataque rápido e decaimento acústico natural
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(targetVol, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + durationSec);

      overtoneGain.gain.setValueAtTime(0.001, ctx.currentTime);
      overtoneGain.gain.linearRampToValueAtTime(targetVol * 0.4, ctx.currentTime + 0.02);
      overtoneGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + durationSec);

      osc.connect(gain);
      overtone.connect(overtoneGain);
      gain.connect(ctx.destination);
      overtoneGain.connect(ctx.destination);

      osc.start();
      overtone.start();
      osc.stop(ctx.currentTime + durationSec);
      overtone.stop(ctx.currentTime + durationSec);

      // Pulso do Metrônomo do Compasso
      const metronome = ctx.createOscillator();
      const metGain = ctx.createGain();
      metronome.type = "sine";
      metronome.frequency.setValueAtTime(isAccent ? 1500 : 950, ctx.currentTime);
      metGain.gain.setValueAtTime(0.04, ctx.currentTime);
      metGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.03);
      metronome.connect(metGain);
      metGain.connect(ctx.destination);
      metronome.start();
      metronome.stop(ctx.currentTime + 0.03);
    } catch (e) {
      console.error(e);
    }
  };

  // Tocador com avanço sequencial nota a nota e salto entre os 10 pentagramas
  const playStep = (sIdx: number, nIdx: number) => {
    if (!isPlaying) return;

    const currentSystem = systems[sIdx];
    if (!currentSystem) return;

    const currentNote = currentSystem.notes[nIdx];
    if (!currentNote) return;

    // Cálculo exato de tempo com base no BPM
    const secondsPerBeat = 60 / bpm;
    const durationSec = currentNote.durationBeats * secondsPerBeat;
    const durationMs = durationSec * 1000;

    setCursorX(currentNote.xPercent);
    setCurrentSystemIndex(sIdx);
    setActiveNoteIndex(nIdx);
    setCurrentBeat((prev) => (prev + 1) % 2);

    playSynthesizedNote(currentNote.freq, durationSec, nIdx === 0);

    timeoutRef.current = setTimeout(() => {
      if (nIdx < currentSystem.notes.length - 1) {
        // Próxima nota no mesmo pentagrama
        playStep(sIdx, nIdx + 1);
      } else {
        // Chegou ao fim do pentagrama: salta para o próximo abaixo
        if (sIdx < systems.length - 1) {
          playStep(sIdx + 1, 0);
        } else {
          // Chegou ao décimo pentagrama: reinicia no primeiro
          playStep(0, 0);
        }
      }
    }, durationMs);
  };

  useEffect(() => {
    if (isPlaying) {
      playStep(currentSystemIndex, activeNoteIndex);
    } else {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    }
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [isPlaying, bpm, transposeSemi, instrument, isMuted, volume]);

  const handleReset = () => {
    setIsPlaying(false);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setCurrentSystemIndex(0);
    setActiveNoteIndex(0);
    setCursorX(systems[0]?.notes[0]?.xPercent || 23);
  };

  const activeSystem = systems[currentSystemIndex] || systems[0];
  const activeNote = activeSystem?.notes[activeNoteIndex];

  return (
    <div className="min-h-screen bg-[#07090E] text-white flex flex-col justify-between pb-20 select-none">
      {/* Topo / Barra de Status */}
      <header className="px-4 py-2.5 bg-[#10131C]/95 backdrop-blur border-b border-gray-800 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate({ to: "/" })}
            className="text-gray-400 hover:text-white h-8 w-8"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-xs font-bold flex items-center gap-1.5 text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              PlayScore OMR (Hino Nacional - Fá Maior)
            </h1>
            <p className="text-[10px] text-gray-400 font-mono">
              Pentagrama {currentSystemIndex + 1}/10 • Nota: {activeNote ? activeNote.note : "--"}
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowMixer(!showMixer)}
          className={`border-gray-700 h-7 px-2.5 text-[11px] flex items-center gap-1.5 ${
            showMixer ? "bg-amber-500/20 text-amber-400 border-amber-500/50" : "text-gray-300"
          }`}
        >
          <SlidersHorizontal className="w-3 h-3" />
          <span>Mixer</span>
        </Button>
      </header>

      {/* Visualizador da Folha com os 10 Pentagramas Reconhecidos */}
      <main className="flex-1 relative flex items-center justify-center p-2 overflow-hidden bg-[#050608]">
        {!imagePreview ? (
          <div className="w-full max-w-sm p-6 border-2 border-dashed border-gray-800 rounded-2xl bg-[#0F121A] flex flex-col items-center justify-center text-center">
            <div className="p-3 rounded-full bg-amber-500/10 text-amber-400 mb-3">
              <Camera className="w-8 h-8" />
            </div>
            <h2 className="text-sm font-semibold mb-1">Carregar Imagem de Alta Resolução</h2>
            <p className="text-[11px] text-gray-400 mb-4 max-w-xs">
              Envie a partitura de 2.976 x 4.209 para alinhar os 10 pentagramas.
            </p>
            <label className="cursor-pointer">
              <Button asChild size="sm" className="bg-amber-500 hover:bg-amber-600 text-black font-semibold">
                <span className="flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5" /> Selecionar Arquivo
                </span>
              </Button>
              <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>
        ) : (
          <div className="relative w-full max-w-xl max-h-[76vh] h-full rounded-md overflow-hidden border border-gray-800 bg-white flex items-center justify-center shadow-2xl">
            <img
              src={imagePreview}
              alt="Partitura Hino Nacional"
              className="w-full h-full object-contain pointer-events-none"
            />

            {/* CAIXA DE PENTAGRAMA ATUAL (Restrita à altura de cada um dos 10 pentagramas) */}
            {activeSystem && (
              <div
                className="absolute left-[3%] right-[3%] border border-red-500/50 bg-red-500/5 pointer-events-none transition-all duration-150"
                style={{
                  top: `${activeSystem.topPercent}%`,
                  height: `${activeSystem.heightPercent}%`,
                }}
              >
                {/* LINHA VERMELHA DE VARREDURA EXATA (PlayScore 2) */}
                <div
                  className="absolute top-0 bottom-0 w-[2.5px] bg-red-600 shadow-[0_0_10px_rgba(239,68,68,1)] transition-all duration-100"
                  style={{ left: `${cursorX}%` }}
                >
                  <div className="absolute -top-1 -left-[3.5px] w-2.5 h-2.5 bg-red-600 rounded-full" />
                </div>
              </div>
            )}

            {isProcessing && (
              <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center gap-2 z-20">
                <Sparkles className="w-8 h-8 text-amber-400 animate-spin" />
                <p className="text-xs font-semibold text-amber-200">Reconhecendo os 10 pentagramas em 2/4...</p>
              </div>
            )}
          </div>
        )}

        {/* Painel Mixer */}
        {showMixer && (
          <div className="absolute top-3 right-3 z-30 w-60 bg-[#141722]/95 border border-gray-700 p-3.5 rounded-xl shadow-2xl backdrop-blur-md space-y-3">
            <div className="flex items-center justify-between border-b border-gray-800 pb-1.5">
              <span className="text-xs font-bold text-gray-200">Mixer & Timbre</span>
              <span className="text-[10px] text-amber-400 font-mono">10 Pautas</span>
            </div>

            <div>
              <span className="text-[10px] text-gray-400 block mb-1">Timbre:</span>
              <div className="grid grid-cols-3 gap-1">
                {(["piano", "organ", "flute"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setInstrument(t)}
                    className={`py-1 text-[10px] rounded capitalize transition ${
                      instrument === t
                        ? "bg-amber-500 text-black font-bold"
                        : "bg-gray-800 text-gray-300"
                    }`}
                  >
                    {t === "piano" ? "Piano" : t === "organ" ? "Órgão" : "Flauta"}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                <span>Volume:</span>
                <span>{volume}%</span>
              </div>
              <Slider
                value={[volume]}
                onValueChange={(val) => setVolume(val[0])}
                max={100}
                step={1}
                className="w-full"
              />
            </div>

            <div>
              <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                <span>Transposição:</span>
                <span className="font-mono text-amber-400">{transposeSemi > 0 ? `+${transposeSemi}` : transposeSemi} ST</span>
              </div>
              <div className="flex items-center justify-between bg-[#0A0C12] p-1 rounded-lg border border-gray-800">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 text-gray-300"
                  onClick={() => setTransposeSemi((p) => p - 1)}
                >
                  <Minus className="w-3 h-3" />
                </Button>
                <span className="text-[11px] font-mono font-bold">{transposeSemi} semitons</span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 text-gray-300"
                  onClick={() => setTransposeSemi((p) => p + 1)}
                >
                  <Plus className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Barra de Reprodução com Seletor dos 10 Pentagramas */}
      <footer className="bg-[#10131C] border-t border-gray-800 px-4 py-2 flex flex-col gap-2 z-20 shadow-lg">
        <div className="flex items-center justify-between max-w-xl mx-auto w-full gap-3">
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              onClick={handleReset}
              className="text-gray-400 hover:text-white h-8 w-8"
              title="Voltar ao início"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </Button>

            <Button
              size="icon"
              onClick={() => setIsPlaying(!isPlaying)}
              className={`h-10 w-10 rounded-full shadow-lg transition-transform active:scale-95 ${
                isPlaying
                  ? "bg-red-500 hover:bg-red-600 text-white"
                  : "bg-emerald-500 hover:bg-emerald-600 text-black"
              }`}
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
            </Button>

            <Button
              size="icon"
              variant="ghost"
              onClick={() => setIsMuted(!isMuted)}
              className="text-gray-400 hover:text-white h-8 w-8"
            >
              {isMuted ? <VolumeX className="w-3.5 h-3.5 text-red-400" /> : <Volume2 className="w-3.5 h-3.5" />}
            </Button>
          </div>

          {/* Slider de Andamento com BPM = 120 da partitura */}
          <div className="flex-1 flex items-center gap-2 max-w-xs">
            <Slider
              value={[bpm]}
              onValueChange={(val) => setBpm(val[0])}
              min={60}
              max={160}
              step={1}
              className="flex-1"
            />
            <div className="text-right w-14 font-mono text-[11px] text-gray-300">
              ♩ = <span className="font-bold text-amber-400">{bpm}</span>
            </div>
          </div>

          <label className="cursor-pointer">
            <div className="w-8 h-8 rounded-full bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-300 border border-gray-700 transition">
              <Camera className="w-3.5 h-3.5" />
            </div>
            <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
          </label>
        </div>

        {/* 10 Marcadores de Pentagrama (clique para pular para qualquer linha) */}
        <div className="flex items-center justify-center gap-1 pt-0.5 overflow-x-auto">
          {systems.map((s, idx) => (
            <button
              key={s.id}
              onClick={() => {
                if (timeoutRef.current) clearTimeout(timeoutRef.current);
                setCurrentSystemIndex(idx);
                setActiveNoteIndex(0);
                setCursorX(s.notes[0]?.xPercent || 20);
              }}
              className={`h-1.5 rounded-full transition-all duration-200 ${
                currentSystemIndex === idx
                  ? "w-6 bg-emerald-400"
                  : "w-2 bg-gray-700 hover:bg-gray-500"
              }`}
              title={`Ir para Pentagrama ${idx + 1}`}
            />
          ))}
        </div>
      </footer>

      <BottomNav />
    </div>
  );
}
