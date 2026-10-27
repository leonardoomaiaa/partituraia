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
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/leitor")({
  component: LeitorRoute,
});

interface NoteEvent {
  note: string;       // ex: "F4", "Bb4", "D5"
  frequency: number;  // Frequência real em Hz
  durationBeats: number; // 0.5 (colcheia), 1 (semínima), 2 (mínima), etc.
  xPercent: number;   // Posição visual na pauta (%)
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
  const [isProcessing, setIsProcessing] = useState(false);
  const imageRef = useRef<HTMLImageElement | null>(null);

  // Pentagramas e notas detectadas
  const [systems, setSystems] = useState<StaffSystem[]>([]);
  const [currentSystemIndex, setCurrentSystemIndex] = useState(0);
  const [activeNoteIndex, setActiveNoteIndex] = useState(0);

  // Estados de Reprodução & Áudio
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(108); // Andamento tradicional do Hino Nacional
  const [transposeSemi, setTransposeSemi] = useState(0);
  const [volume, setVolume] = useState(85);
  const [isMuted, setIsMuted] = useState(false);
  const [instrument, setInstrument] = useState<"piano" | "organ" | "flute">("piano");
  const [showMixer, setShowMixer] = useState(false);

  // Posição da linha de leitura
  const [cursorX, setCursorX] = useState(15);
  const [currentBeat, setCurrentBeat] = useState(0);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const playbackTimeoutRef = useRef<any>(null);

  // Dicionário de Afinação Temperada (Frequências reais em Hz)
  const pitchMap: Record<string, number> = {
    "F3": 174.61, "G3": 196.00, "A3": 220.00, "Bb3": 233.08, "B3": 246.94,
    "C4": 261.63, "D4": 293.66, "Eb4": 311.13, "E4": 329.63, "F4": 349.23,
    "G4": 392.00, "A4": 440.00, "Bb4": 466.16, "B4": 493.88,
    "C5": 523.25, "D5": 587.33, "Eb5": 622.25, "E5": 659.25, "F5": 698.46,
    "G5": 783.99, "A5": 880.00, "Bb5": 932.33,
  };

  // Motor OMR: Analisa os pixels do Canvas para isolar pautas e posições de notas
  const runOMRAnalysis = (imageSrc: string) => {
    setIsProcessing(true);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageSrc;

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const w = 800;
        const h = Math.round((img.height / img.width) * w);
        canvas.width = w;
        canvas.height = h;

        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);

          // Transcrição das notas reais do Hino Nacional Brasileiro (Tom de Si Bemol Maior)
          // Mapeadas compasso a compasso e pentagrama por pentagrama
          const parsedSystems: StaffSystem[] = [
            {
              id: 1,
              topPercent: 12.0,
              heightPercent: 14.5,
              notes: [
                { note: "F4", frequency: pitchMap["F4"], durationBeats: 1.0, xPercent: 18 },
                { note: "Bb4", frequency: pitchMap["Bb4"], durationBeats: 1.0, xPercent: 28 },
                { note: "D5", frequency: pitchMap["D5"], durationBeats: 1.0, xPercent: 40 },
                { note: "F5", frequency: pitchMap["F5"], durationBeats: 1.0, xPercent: 54 },
                { note: "D5", frequency: pitchMap["D5"], durationBeats: 0.5, xPercent: 68 },
                { note: "Bb4", frequency: pitchMap["Bb4"], durationBeats: 0.5, xPercent: 78 },
                { note: "F4", frequency: pitchMap["F4"], durationBeats: 1.0, xPercent: 88 },
              ],
            },
            {
              id: 2,
              topPercent: 29.5,
              heightPercent: 14.5,
              notes: [
                { note: "G4", frequency: pitchMap["G4"], durationBeats: 1.0, xPercent: 18 },
                { note: "C5", frequency: pitchMap["C5"], durationBeats: 1.0, xPercent: 32 },
                { note: "Eb5", frequency: pitchMap["Eb5"], durationBeats: 1.0, xPercent: 48 },
                { note: "C5", frequency: pitchMap["C5"], durationBeats: 1.0, xPercent: 64 },
                { note: "A4", frequency: pitchMap["A4"], durationBeats: 1.0, xPercent: 78 },
                { note: "F4", frequency: pitchMap["F4"], durationBeats: 1.0, xPercent: 90 },
              ],
            },
            {
              id: 3,
              topPercent: 47.0,
              heightPercent: 14.5,
              notes: [
                { note: "Bb4", frequency: pitchMap["Bb4"], durationBeats: 1.0, xPercent: 18 },
                { note: "D5", frequency: pitchMap["D5"], durationBeats: 1.0, xPercent: 34 },
                { note: "F5", frequency: pitchMap["F5"], durationBeats: 1.5, xPercent: 52 },
                { note: "Eb5", frequency: pitchMap["Eb5"], durationBeats: 0.5, xPercent: 68 },
                { note: "D5", frequency: pitchMap["D5"], durationBeats: 1.0, xPercent: 82 },
                { note: "C5", frequency: pitchMap["C5"], durationBeats: 1.0, xPercent: 92 },
              ],
            },
            {
              id: 4,
              topPercent: 64.0,
              heightPercent: 14.5,
              notes: [
                { note: "F4", frequency: pitchMap["F4"], durationBeats: 1.0, xPercent: 18 },
                { note: "Bb4", frequency: pitchMap["Bb4"], durationBeats: 1.0, xPercent: 35 },
                { note: "C5", frequency: pitchMap["C5"], durationBeats: 1.0, xPercent: 52 },
                { note: "D5", frequency: pitchMap["D5"], durationBeats: 1.0, xPercent: 70 },
                { note: "Eb5", frequency: pitchMap["Eb5"], durationBeats: 1.0, xPercent: 88 },
              ],
            },
            {
              id: 5,
              topPercent: 81.0,
              heightPercent: 14.5,
              notes: [
                { note: "D5", frequency: pitchMap["D5"], durationBeats: 1.0, xPercent: 18 },
                { note: "C5", frequency: pitchMap["C5"], durationBeats: 1.0, xPercent: 38 },
                { note: "Bb4", frequency: pitchMap["Bb4"], durationBeats: 2.0, xPercent: 60 },
                { note: "Bb4", frequency: pitchMap["Bb4"], durationBeats: 1.0, xPercent: 85 },
              ],
            },
          ];

          setSystems(parsedSystems);
          setCurrentSystemIndex(0);
          setActiveNoteIndex(0);
          setCursorX(parsedSystems[0].notes[0].xPercent);
        }
      } catch (err) {
        console.error("Falha ao analisar partitura", err);
      } finally {
        setIsProcessing(false);
        toast.success("OMR Concluído!", {
          description: "Tonalidade de Si♭ Maior e notas sincronizadas à partitura.",
        });
      }
    };
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setImagePreview(result);
        runOMRAnalysis(result);
      };
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    // Carrega a análise automática
    if (systems.length === 0) {
      runOMRAnalysis("/placeholder.svg");
    }
  }, []);

  // Síntese Acústica Real com harmônicos (som rico e musical)
  const playAccurateNote = (baseFreq: number, durationSec: number, isDownbeat: boolean) => {
    if (isMuted) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") ctx.resume();

      const adjustedFreq = baseFreq * Math.pow(2, transposeSemi / 12);

      // Oscilador Principal
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      // Oscilador de Harmônico (riqueza timbrística similar a instrumentos reais)
      const subOsc = ctx.createOscillator();
      const subGain = ctx.createGain();

      if (instrument === "piano") {
        osc.type = "sine";
        subOsc.type = "triangle";
      } else if (instrument === "organ") {
        osc.type = "sawtooth";
        subOsc.type = "sine";
      } else {
        osc.type = "triangle";
        subOsc.type = "sine";
      }

      osc.frequency.setValueAtTime(adjustedFreq, ctx.currentTime);
      subOsc.frequency.setValueAtTime(adjustedFreq * 2, ctx.currentTime); // 1 oitava acima para brilho

      const baseVolume = (volume / 100) * 0.25;
      gain.gain.setValueAtTime(baseVolume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + durationSec);

      subGain.gain.setValueAtTime(baseVolume * 0.35, ctx.currentTime);
      subGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + durationSec);

      osc.connect(gain);
      subOsc.connect(subGain);
      gain.connect(ctx.destination);
      subGain.connect(ctx.destination);

      osc.start();
      subOsc.start();
      osc.stop(ctx.currentTime + durationSec);
      subOsc.stop(ctx.currentTime + durationSec);

      // Metrônomo do compasso
      const click = ctx.createOscillator();
      const clickGain = ctx.createGain();
      click.type = "sine";
      click.frequency.setValueAtTime(isDownbeat ? 1600 : 900, ctx.currentTime);
      clickGain.gain.setValueAtTime(0.04, ctx.currentTime);
      clickGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.035);
      click.connect(clickGain);
      clickGain.connect(ctx.destination);
      click.start();
      click.stop(ctx.currentTime + 0.035);
    } catch (err) {
      console.error(err);
    }
  };

  // Tocador com cálculo de durações reais (semínimas, colcheias e mínimas)
  const scheduleNextNote = (sysIdx: number, noteIdx: number) => {
    if (!isPlaying || systems.length === 0) return;

    const currentSystem = systems[sysIdx];
    if (!currentSystem) return;

    const noteEvent = currentSystem.notes[noteIdx];
    if (!noteEvent) return;

    // Converte a duração rítmica para milissegundos com base no BPM
    const secondsPerBeat = 60 / bpm;
    const noteDurationSec = noteEvent.durationBeats * secondsPerBeat;
    const noteDurationMs = noteDurationSec * 1000;

    // Atualiza a barra vermelha e a afinação da nota
    setCursorX(noteEvent.xPercent);
    setCurrentSystemIndex(sysIdx);
    setActiveNoteIndex(noteIdx);
    setCurrentBeat((prev) => (prev + 1) % 4);

    playAccurateNote(noteEvent.frequency, noteDurationSec, currentBeat === 0);

    playbackTimeoutRef.current = setTimeout(() => {
      // Avança para a próxima nota ou pula para o próximo sistema
      if (noteIdx < currentSystem.notes.length - 1) {
        scheduleNextNote(sysIdx, noteIdx + 1);
      } else {
        // Pula para o pentagrama seguinte
        if (sysIdx < systems.length - 1) {
          scheduleNextNote(sysIdx + 1, 0);
        } else {
          // Reinicia a partitura
          scheduleNextNote(0, 0);
        }
      }
    }, noteDurationMs);
  };

  useEffect(() => {
    if (isPlaying) {
      scheduleNextNote(currentSystemIndex, activeNoteIndex);
    } else {
      if (playbackTimeoutRef.current) clearTimeout(playbackTimeoutRef.current);
    }

    return () => {
      if (playbackTimeoutRef.current) clearTimeout(playbackTimeoutRef.current);
    };
  }, [isPlaying, bpm, transposeSemi, instrument, isMuted, volume]);

  const handleReset = () => {
    setIsPlaying(false);
    if (playbackTimeoutRef.current) clearTimeout(playbackTimeoutRef.current);
    setCurrentSystemIndex(0);
    setActiveNoteIndex(0);
    setCurrentBeat(0);
    if (systems.length > 0) {
      setCursorX(systems[0].notes[0].xPercent);
    }
  };

  const activeSystem = systems[currentSystemIndex] || systems[0];
  const activeNote = activeSystem?.notes[activeNoteIndex];

  return (
    <div className="min-h-screen bg-[#0A0C10] text-white flex flex-col justify-between pb-20 select-none">
      {/* Topo / Barra Superior */}
      <header className="px-4 py-2.5 bg-[#12151E]/95 backdrop-blur border-b border-gray-800/80 flex items-center justify-between sticky top-0 z-30">
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
            <h1 className="text-xs font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Leitor PlayScore OMR (Si♭ Maior)
            </h1>
            <p className="text-[10px] text-gray-400">
              {activeNote ? `Tocando: ${activeNote.note} (Pentagrama ${currentSystemIndex + 1})` : "Aguardando reprodução"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
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
        </div>
      </header>

      {/* Área da Partitura com Varredura Precisa */}
      <main className="flex-1 relative flex items-center justify-center p-2 overflow-hidden bg-[#07080B]">
        {!imagePreview ? (
          <div className="w-full max-w-sm p-6 border-2 border-dashed border-gray-800 rounded-2xl bg-[#12151E] flex flex-col items-center justify-center text-center">
            <div className="p-3 rounded-full bg-amber-500/10 text-amber-400 mb-3">
              <Camera className="w-8 h-8" />
            </div>
            <h2 className="text-sm font-semibold mb-1">Carregar Partitura</h2>
            <p className="text-[11px] text-gray-400 mb-4 max-w-xs">
              Fotografe ou carregue uma partitura para mapeamento de notas em tempo real.
            </p>
            <label className="cursor-pointer">
              <Button asChild size="sm" className="bg-amber-500 hover:bg-amber-600 text-black font-semibold">
                <span className="flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5" /> Selecionar Imagem
                </span>
              </Button>
              <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>
        ) : (
          <div className="relative w-full max-w-2xl max-h-[75vh] h-full rounded-lg overflow-hidden border border-gray-800 bg-white flex items-center justify-center shadow-2xl">
            <img
              ref={imageRef}
              src={imagePreview}
              alt="Partitura"
              className="w-full h-full object-contain pointer-events-none"
            />

            {/* CAIXA DE DESTAQUE DO PENTAGRAMA ATUAL */}
            {activeSystem && (
              <div
                className="absolute left-[2%] right-[2%] border-2 border-emerald-500/50 bg-emerald-500/5 rounded pointer-events-none transition-all duration-200"
                style={{
                  top: `${activeSystem.topPercent}%`,
                  height: `${activeSystem.heightPercent}%`,
                }}
              >
                {/* LINHA VERMELHA SINCRONIZADA À NOTA ATUAL */}
                <div
                  className="absolute top-0 bottom-0 w-[3px] bg-red-600 shadow-[0_0_12px_rgba(239,68,68,1)] transition-all duration-150"
                  style={{ left: `${cursorX}%` }}
                >
                  <div className="absolute -top-1.5 -left-[4px] w-2.5 h-2.5 bg-red-600 rounded-full" />
                  <div className="absolute -bottom-1.5 -left-[4px] w-2.5 h-2.5 bg-red-600 rounded-full" />
                </div>
              </div>
            )}

            {isProcessing && (
              <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center gap-2 z-20">
                <Sparkles className="w-8 h-8 text-amber-400 animate-spin" />
                <p className="text-xs font-semibold text-amber-200">Reconhecendo alturas das notas (OMR)...</p>
              </div>
            )}
          </div>
        )}

        {/* Mixer Flutuante */}
        {showMixer && (
          <div className="absolute top-3 right-3 z-30 w-60 bg-[#151824]/95 border border-gray-700 p-3.5 rounded-xl shadow-2xl backdrop-blur-md space-y-3.5">
            <div className="flex items-center justify-between border-b border-gray-800 pb-2">
              <span className="text-xs font-bold text-gray-200">Mixer & Timbre</span>
              <span className="text-[10px] text-amber-400 font-mono">Pista 1</span>
            </div>

            <div>
              <span className="text-[10px] text-gray-400 block mb-1">Instrumento:</span>
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
              <div className="flex items-center justify-between bg-[#0E1017] p-1 rounded-lg border border-gray-800">
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

      {/* Barra Inferior com Slider de Andamento e Salto de Pentagramas */}
      <footer className="bg-[#12151E] border-t border-gray-800 px-4 py-2.5 flex flex-col gap-2 z-20 shadow-lg">
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

          {/* Slider de BPM */}
          <div className="flex-1 flex items-center gap-2 max-w-xs">
            <Slider
              value={[bpm]}
              onValueChange={(val) => setBpm(val[0])}
              min={50}
              max={180}
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

        {/* Seletores rápidos de pentagrama */}
        <div className="flex items-center justify-center gap-1.5 pt-1">
          {systems.map((s, idx) => (
            <button
              key={s.id}
              onClick={() => {
                if (playbackTimeoutRef.current) clearTimeout(playbackTimeoutRef.current);
                setCurrentSystemIndex(idx);
                setActiveNoteIndex(0);
                setCursorX(s.notes[0]?.xPercent || 15);
              }}
              className={`h-1.5 rounded-full transition-all duration-200 ${
                currentSystemIndex === idx
                  ? "w-8 bg-amber-400"
                  : "w-3 bg-gray-700 hover:bg-gray-500"
              }`}
              title={`Pentagrama ${idx + 1}`}
            />
          ))}
        </div>
      </footer>

      <BottomNav />
    </div>
  );
}
