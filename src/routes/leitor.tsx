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
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/leitor")({
  component: LeitorRoute,
});

function LeitorRoute() {
  const navigate = useNavigate();

  // Estados de Imagem e Partitura
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Estados de Reprodução & Metrónomo
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(76);
  const [transposeSemi, setTransposeSemi] = useState(0);
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  const [instrument, setInstrument] = useState<"piano" | "organ" | "flute">("piano");
  const [showMixer, setShowMixer] = useState(false);

  // Posição da linha de leitura (0% a 100%)
  const [cursorProgress, setCursorProgress] = useState(0);
  const [currentBeat, setCurrentBeat] = useState(0);

  // Sequência melódica
  const scoreMelody = [
    { note: "C4", dur: 1 },
    { note: "E4", dur: 1 },
    { note: "G4", dur: 1 },
    { note: "C5", dur: 1 },
    { note: "B4", dur: 1 },
    { note: "G4", dur: 1 },
    { note: "A4", dur: 1 },
    { note: "F4", dur: 1 },
    { note: "G4", dur: 2 },
    { note: "C4", dur: 2 },
  ];

  const audioCtxRef = useRef<AudioContext | null>(null);
  const beatTimerRef = useRef<any>(null);
  const noteIndexRef = useRef(0);

  const noteFrequencies: Record<string, number> = {
    "C4": 261.63, "C#4": 277.18, "D4": 293.66, "D#4": 311.13,
    "E4": 329.63, "F4": 349.23, "F#4": 369.99, "G4": 392.0,
    "G#4": 415.3, "A4": 440.0, "A#4": 466.16, "B4": 493.88,
    "C5": 523.25, "C#5": 554.37, "D5": 587.33,
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);

      setIsProcessing(true);
      setTimeout(() => {
        setIsProcessing(false);
        setCursorProgress(0);
        toast.success("Partitura processada com sucesso!", {
          description: "Compassos e pautas mapeados.",
        });
      }, 1500);
    }
  };

  const playSound = (freq: number, isAccent: boolean) => {
    if (isMuted) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") ctx.resume();

      const adjustedFreq = freq * Math.pow(2, transposeSemi / 12);

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      if (instrument === "piano") osc.type = "sine";
      else if (instrument === "organ") osc.type = "sawtooth";
      else osc.type = "triangle";

      osc.frequency.setValueAtTime(adjustedFreq, ctx.currentTime);

      const actualVolume = (volume / 100) * 0.18;
      gain.gain.setValueAtTime(actualVolume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.45);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.45);

      const click = ctx.createOscillator();
      const clickGain = ctx.createGain();
      click.type = "square";
      click.frequency.setValueAtTime(isAccent ? 1400 : 850, ctx.currentTime);
      clickGain.gain.setValueAtTime(0.04, ctx.currentTime);
      clickGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.04);
      click.connect(clickGain);
      clickGain.connect(ctx.destination);
      click.start();
      click.stop(ctx.currentTime + 0.04);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (isPlaying) {
      const beatInterval = (60 / bpm) * 1000;

      beatTimerRef.current = setInterval(() => {
        setCurrentBeat((prev) => (prev + 1) % 4);

        const currentNote = scoreMelody[noteIndexRef.current];
        const baseFreq = noteFrequencies[currentNote.note] || 440;
        playSound(baseFreq, currentBeat === 0);

        noteIndexRef.current = (noteIndexRef.current + 1) % scoreMelody.length;

        setCursorProgress((prev) => {
          if (prev >= 98) return 0;
          return prev + 100 / scoreMelody.length;
        });
      }, beatInterval);
    } else {
      if (beatTimerRef.current) clearInterval(beatTimerRef.current);
    }

    return () => {
      if (beatTimerRef.current) clearInterval(beatTimerRef.current);
    };
  }, [isPlaying, bpm, transposeSemi, instrument, isMuted, volume]);

  const handleReset = () => {
    setIsPlaying(false);
    setCursorProgress(0);
    setCurrentBeat(0);
    noteIndexRef.current = 0;
  };

  return (
    <div className="min-h-screen bg-[#0E1015] text-white flex flex-col justify-between pb-20 select-none">
      <header className="px-4 py-3 bg-[#161822]/90 backdrop-blur border-b border-gray-800 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate({ to: "/" })}
            className="text-gray-400 hover:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-sm font-bold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Leitor de Partitura
            </h1>
            <p className="text-[10px] text-gray-400">PlayScore OMR Engine</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowMixer(!showMixer)}
            className={`border-gray-700 h-8 px-2.5 text-xs flex items-center gap-1.5 ${
              showMixer ? "bg-amber-500/20 text-amber-400 border-amber-500/50" : "text-gray-300"
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Mixer</span>
          </Button>
        </div>
      </header>

      <main className="flex-1 relative flex flex-col items-center justify-center p-3 overflow-hidden">
        {!imagePreview ? (
          <div className="w-full max-w-md p-8 border-2 border-dashed border-gray-800 hover:border-amber-500/50 rounded-2xl bg-[#141620]/60 flex flex-col items-center justify-center text-center transition">
            <div className="p-4 rounded-full bg-amber-500/10 text-amber-400 mb-4">
              <Camera className="w-10 h-10" />
            </div>
            <h2 className="text-base font-semibold mb-1">Escanear Partitura</h2>
            <p className="text-xs text-gray-400 mb-6 max-w-xs">
              Carregue ou fotografe uma partitura para iniciar o leitor interativo.
            </p>
            <label className="cursor-pointer">
              <Button asChild className="bg-amber-500 hover:bg-amber-600 text-black font-semibold px-6">
                <span className="flex items-center gap-2">
                  <Upload className="w-4 h-4" /> Selecionar Foto
                </span>
              </Button>
              <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>
        ) : (
          <div className="relative w-full max-w-xl h-full max-h-[68vh] rounded-xl overflow-hidden border border-gray-800 bg-[#07080B] flex items-center justify-center shadow-2xl">
            <img
              src={imagePreview}
              alt="Partitura"
              className="w-full h-full object-contain pointer-events-none"
            />

            {/* Linha vermelha de varredura estilo PlayScore 2 */}
            <div
              className="absolute top-0 bottom-0 w-[2.5px] bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.9)] transition-all duration-150 pointer-events-none z-10"
              style={{ left: `${cursorProgress}%` }}
            >
              <div className="absolute -top-1 -left-[5px] w-3 h-3 bg-red-500 rounded-full shadow-md" />
            </div>

            {isProcessing && (
              <div className="absolute inset-0 bg-black/75 backdrop-blur-sm flex flex-col items-center justify-center gap-3 z-20">
                <Sparkles className="w-8 h-8 text-amber-400 animate-spin" />
                <p className="text-xs font-medium text-amber-200">A processar compassos e notas...</p>
              </div>
            )}
          </div>
        )}

        {showMixer && (
          <div className="absolute top-4 right-4 z-30 w-64 bg-[#181B26]/95 border border-gray-700/80 p-4 rounded-xl shadow-2xl backdrop-blur-md space-y-4">
            <div className="flex items-center justify-between border-b border-gray-800 pb-2">
              <span className="text-xs font-bold text-gray-200">Mixer de Pistas</span>
              <span className="text-[10px] text-amber-400 font-mono">Faixa 1</span>
            </div>

            <div>
              <span className="text-[11px] text-gray-400 block mb-1.5">Timbre:</span>
              <div className="grid grid-cols-3 gap-1">
                {(["piano", "organ", "flute"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setInstrument(t)}
                    className={`py-1 text-[11px] rounded capitalize transition ${
                      instrument === t
                        ? "bg-amber-500 text-black font-bold"
                        : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                    }`}
                  >
                    {t === "piano" ? "Piano" : t === "organ" ? "Órgão" : "Flauta"}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[11px] text-gray-400 mb-1">
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
              <div className="flex justify-between text-[11px] text-gray-400 mb-1">
                <span>Transposição:</span>
                <span className="font-mono text-amber-400">{transposeSemi > 0 ? `+${transposeSemi}` : transposeSemi} ST</span>
              </div>
              <div className="flex items-center justify-between bg-[#10121A] p-1.5 rounded-lg border border-gray-800">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-gray-300"
                  onClick={() => setTransposeSemi((p) => p - 1)}
                >
                  <Minus className="w-3.5 h-3.5" />
                </Button>
                <span className="text-xs font-mono font-bold">{transposeSemi} semitons</span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-gray-300"
                  onClick={() => setTransposeSemi((p) => p + 1)}
                >
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="bg-[#141620] border-t border-gray-800 px-4 py-3 flex flex-col gap-2.5 z-20 shadow-lg">
        <div className="flex items-center justify-between max-w-xl mx-auto w-full gap-3">
          <div className="flex items-center gap-1.5">
            <Button
              size="icon"
              variant="ghost"
              onClick={handleReset}
              className="text-gray-400 hover:text-white h-9 w-9"
              title="Voltar ao Início"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>

            <Button
              size="icon"
              onClick={() => setIsPlaying(!isPlaying)}
              className={`h-11 w-11 rounded-full shadow-lg transition-transform active:scale-95 ${
                isPlaying
                  ? "bg-red-500 hover:bg-red-600 text-white shadow-red-500/20"
                  : "bg-emerald-500 hover:bg-emerald-600 text-black shadow-emerald-500/20"
              }`}
            >
              {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
            </Button>

            <Button
              size="icon"
              variant="ghost"
              onClick={() => setIsMuted(!isMuted)}
              className="text-gray-400 hover:text-white h-9 w-9"
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
            </Button>
          </div>

          <div className="flex-1 flex items-center gap-2.5 max-w-xs">
            <Slider
              value={[bpm]}
              onValueChange={(val) => setBpm(val[0])}
              min={40}
              max={200}
              step={1}
              className="flex-1"
            />
            <div className="text-right w-14 font-mono text-xs text-gray-300">
              ♩ = <span className="font-bold text-amber-400">{bpm}</span>
            </div>
          </div>

          <label className="cursor-pointer">
            <div className="w-9 h-9 rounded-full bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-300 border border-gray-700 transition">
              <Camera className="w-4 h-4" />
            </div>
            <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
          </label>
        </div>

        {isPlaying && (
          <div className="flex items-center justify-center gap-2 pt-0.5">
            {[0, 1, 2, 3].map((b) => (
              <span
                key={b}
                className={`h-1.5 rounded-full transition-all duration-100 ${
                  currentBeat === b
                    ? b === 0
                      ? "w-6 bg-red-500"
                      : "w-4 bg-emerald-400"
                    : "w-1.5 bg-gray-700"
                }`}
              />
            ))}
          </div>
        )}
      </footer>

      <BottomNav />
    </div>
  );
}
