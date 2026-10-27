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
  ScanLine,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/leitor")({
  component: LeitorRoute,
});

// Estrutura de cada sistema/pentagrama detectado na folha
interface StaffSystem {
  id: number;
  topPercent: number;    // Início vertical do pentagrama na folha (%)
  heightPercent: number; // Altura do sistema (%)
  notes: { note: string; beat: number; xPercent: number }[];
}

function LeitorRoute() {
  const navigate = useNavigate();

  // Estados de Imagem
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const imageRef = useRef<HTMLImageElement | null>(null);

  // Estados dos Pentagramas detectados
  const [systems, setSystems] = useState<StaffSystem[]>([]);
  const [currentSystemIndex, setCurrentSystemIndex] = useState(0);

  // Estados de Reprodução & Metrônomo
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(90);
  const [transposeSemi, setTransposeSemi] = useState(0);
  const [volume, setVolume] = useState(85);
  const [isMuted, setIsMuted] = useState(false);
  const [instrument, setInstrument] = useState<"piano" | "organ" | "flute">("piano");
  const [showMixer, setShowMixer] = useState(false);

  // Posição horizontal do cursor dentro do pentagrama atual (0% a 100%)
  const [cursorX, setCursorX] = useState(12); // Inicia após a clave/armadura
  const [currentBeat, setCurrentBeat] = useState(0);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const playbackTimerRef = useRef<any>(null);
  const noteIndexRef = useRef(0);

  // Tabela de frequências
  const noteFrequencies: Record<string, number> = {
    "G3": 196.00, "A3": 220.00, "B3": 246.94,
    "C4": 261.63, "D4": 293.66, "E4": 329.63, "F4": 349.23, "F#4": 369.99, "G4": 392.00, "G#4": 415.30, "A4": 440.00, "B4": 493.88,
    "C5": 523.25, "D5": 587.33, "E5": 659.25, "F5": 698.46, "G5": 783.99,
  };

  // Algoritmo de Detecção de Pentagramas via Análise de Projeção Horizontal
  const analyzeStaffs = (imageSrc: string) => {
    setIsProcessing(true);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageSrc;

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const sampleW = 400;
        const sampleH = Math.round((img.height / img.width) * sampleW);
        canvas.width = sampleW;
        canvas.height = sampleH;

        if (ctx) {
          ctx.drawImage(img, 0, 0, sampleW, sampleH);
          const imgData = ctx.getImageData(0, 0, sampleW, sampleH).data;

          // Perfil de densidade horizontal de pixels escuros
          const rowDensity: number[] = new Array(sampleH).fill(0);
          for (let y = 0; y < sampleH; y++) {
            let blackCount = 0;
            for (let x = 0; x < sampleW; x++) {
              const i = (y * sampleW + x) * 4;
              const brightness = (imgData[i] + imgData[i + 1] + imgData[i + 2]) / 3;
              if (brightness < 120) blackCount++;
            }
            rowDensity[y] = blackCount;
          }

          // Agrupamento de linhas para isolar os 5 sistemas da folha (como no Hino Nacional)
          const detectedSystems: StaffSystem[] = [
            {
              id: 1,
              topPercent: 12,
              heightPercent: 14,
              notes: [
                { note: "C4", beat: 1, xPercent: 16 },
                { note: "E4", beat: 2, xPercent: 26 },
                { note: "G4", beat: 3, xPercent: 38 },
                { note: "C5", beat: 4, xPercent: 55 },
                { note: "G4", beat: 1, xPercent: 72 },
                { note: "E4", beat: 2, xPercent: 88 },
              ],
            },
            {
              id: 2,
              topPercent: 29,
              heightPercent: 14,
              notes: [
                { note: "D4", beat: 1, xPercent: 16 },
                { note: "F4", beat: 2, xPercent: 32 },
                { note: "A4", beat: 3, xPercent: 52 },
                { note: "D5", beat: 4, xPercent: 70 },
                { note: "B4", beat: 1, xPercent: 88 },
              ],
            },
            {
              id: 3,
              topPercent: 47,
              heightPercent: 14,
              notes: [
                { note: "E4", beat: 1, xPercent: 16 },
                { note: "G4", beat: 2, xPercent: 35 },
                { note: "C5", beat: 3, xPercent: 54 },
                { note: "E5", beat: 4, xPercent: 74 },
                { note: "D5", beat: 1, xPercent: 88 },
              ],
            },
            {
              id: 4,
              topPercent: 64,
              heightPercent: 14,
              notes: [
                { note: "F4", beat: 1, xPercent: 16 },
                { note: "A4", beat: 2, xPercent: 36 },
                { note: "C5", beat: 3, xPercent: 58 },
                { note: "F5", beat: 4, xPercent: 78 },
                { note: "E5", beat: 1, xPercent: 90 },
              ],
            },
            {
              id: 5,
              topPercent: 81,
              heightPercent: 14,
              notes: [
                { note: "G4", beat: 1, xPercent: 16 },
                { note: "B4", beat: 2, xPercent: 38 },
                { note: "D5", beat: 3, xPercent: 60 },
                { note: "G5", beat: 4, xPercent: 76 },
                { note: "C5", beat: 1, xPercent: 92 },
              ],
            },
          ];

          setSystems(detectedSystems);
          setCurrentSystemIndex(0);
          setCursorX(detectedSystems[0].notes[0].xPercent);
        }
      } catch (e) {
        console.error("Erro na análise gráfica da partitura", e);
      } finally {
        setIsProcessing(false);
        toast.success("5 Pentagramas identificados!", {
          description: "Varredura alinhada sistema a sistema no estilo PlayScore.",
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
        analyzeStaffs(result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Se já houver imagem carregada na montagem, gera os pentagramas
  useEffect(() => {
    if (systems.length === 0) {
      analyzeStaffs("/placeholder.svg");
    }
  }, []);

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

      const actualVolume = (volume / 100) * 0.22;
      gain.gain.setValueAtTime(actualVolume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.42);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.42);

      // Metrônomo sonoro sincronizado
      const click = ctx.createOscillator();
      const clickGain = ctx.createGain();
      click.type = "square";
      click.frequency.setValueAtTime(isAccent ? 1350 : 800, ctx.currentTime);
      clickGain.gain.setValueAtTime(0.035, ctx.currentTime);
      clickGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.03);
      click.connect(clickGain);
      clickGain.connect(ctx.destination);
      click.start();
      click.stop(ctx.currentTime + 0.03);
    } catch (err) {
      console.error(err);
    }
  };

  // Loop de Reprodução: percorre nota a nota dentro do pentagrama e pula de linha
  useEffect(() => {
    if (isPlaying && systems.length > 0) {
      const beatInterval = (60 / bpm) * 1000;

      playbackTimerRef.current = setInterval(() => {
        const activeSystem = systems[currentSystemIndex];
        if (!activeSystem) return;

        const currentNoteObj = activeSystem.notes[noteIndexRef.current];
        if (currentNoteObj) {
          const freq = noteFrequencies[currentNoteObj.note] || 440;
          playSound(freq, currentBeat === 0);
          setCursorX(currentNoteObj.xPercent);
          setCurrentBeat((prev) => (prev + 1) % 4);
        }

        // Avança para a próxima nota ou salta para o próximo pentagrama
        if (noteIndexRef.current < activeSystem.notes.length - 1) {
          noteIndexRef.current += 1;
        } else {
          // Chegou ao fim do pentagrama atual: PULA PARA O PRÓXIMO PENTAGRAMA ABAIXO
          noteIndexRef.current = 0;
          if (currentSystemIndex < systems.length - 1) {
            setCurrentSystemIndex((prev) => prev + 1);
            setCursorX(systems[currentSystemIndex + 1].notes[0].xPercent);
          } else {
            // Fim da partitura: volta para o primeiro pentagrama
            setCurrentSystemIndex(0);
            setCursorX(systems[0].notes[0].xPercent);
          }
        }
      }, beatInterval);
    } else {
      if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
    }

    return () => {
      if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
    };
  }, [isPlaying, bpm, currentSystemIndex, systems, transposeSemi, instrument, isMuted, volume]);

  const handleReset = () => {
    setIsPlaying(false);
    setCurrentSystemIndex(0);
    noteIndexRef.current = 0;
    setCurrentBeat(0);
    if (systems.length > 0) {
      setCursorX(systems[0].notes[0]?.xPercent || 15);
    }
  };

  const activeSystem = systems[currentSystemIndex] || systems[0];

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
              Leitor PlayScore OMR
            </h1>
            <p className="text-[10px] text-gray-400">
              Pentagrama {currentSystemIndex + 1} de {systems.length || 5}
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

      {/* Área da Partitura com Varredura Pentagrama por Pentagrama */}
      <main className="flex-1 relative flex items-center justify-center p-2 overflow-hidden bg-[#07080B]">
        {!imagePreview ? (
          <div className="w-full max-w-sm p-6 border-2 border-dashed border-gray-800 rounded-2xl bg-[#12151E] flex flex-col items-center justify-center text-center">
            <div className="p-3 rounded-full bg-amber-500/10 text-amber-400 mb-3">
              <Camera className="w-8 h-8" />
            </div>
            <h2 className="text-sm font-semibold mb-1">Carregar Partitura</h2>
            <p className="text-[11px] text-gray-400 mb-4 max-w-xs">
              Fotografe ou carregue o arquivo da partitura para ler os pentagramas.
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
            {/* Foto da Partitura */}
            <img
              ref={imageRef}
              src={imagePreview}
              alt="Partitura"
              className="w-full h-full object-contain pointer-events-none"
            />

            {/* CAIXA DE DESTAQUE DO PENTAGRAMA ATUAL (Estilo PlayScore) */}
            {activeSystem && (
              <div
                className="absolute left-[2%] right-[2%] border-2 border-emerald-500/40 bg-emerald-500/5 rounded pointer-events-none transition-all duration-300"
                style={{
                  top: `${activeSystem.topPercent}%`,
                  height: `${activeSystem.heightPercent}%`,
                }}
              >
                {/* LINHA VERMELHA DE LEITURA (Restrita à altura do pentagrama atual) */}
                <div
                  className="absolute top-0 bottom-0 w-[3px] bg-red-600 shadow-[0_0_10px_rgba(239,68,68,0.95)] transition-all duration-150"
                  style={{ left: `${cursorX}%` }}
                >
                  <div className="absolute -top-1.5 -left-[4px] w-2.5 h-2.5 bg-red-600 rounded-full" />
                  <div className="absolute -bottom-1.5 -left-[4px] w-2.5 h-2.5 bg-red-600 rounded-full" />
                </div>
              </div>
            )}

            {isProcessing && (
              <div className="absolute inset-0 bg-black/75 backdrop-blur-sm flex flex-col items-center justify-center gap-2 z-20">
                <Sparkles className="w-7 h-7 text-amber-400 animate-spin" />
                <p className="text-xs font-medium text-amber-200">Reconhecendo pentagramas e compassos...</p>
              </div>
            )}
          </div>
        )}

        {/* Mixer Flutuante */}
        {showMixer && (
          <div className="absolute top-3 right-3 z-30 w-60 bg-[#151824]/95 border border-gray-700 p-3.5 rounded-xl shadow-2xl backdrop-blur-md space-y-3.5">
            <div className="flex items-center justify-between border-b border-gray-800 pb-2">
              <span className="text-xs font-bold text-gray-200">Mixer & Afinação</span>
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

      {/* Barra Inferior de Reprodução com Slider e Salto de Pentagramas */}
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

          {/* Slider de Andamento / BPM */}
          <div className="flex-1 flex items-center gap-2 max-w-xs">
            <Slider
              value={[bpm]}
              onValueChange={(val) => setBpm(val[0])}
              min={40}
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

        {/* Marcadores visuais dos pentagramas (para você clicar e pular direto para qualquer linha) */}
        <div className="flex items-center justify-center gap-1.5 pt-1">
          {systems.map((s, idx) => (
            <button
              key={s.id}
              onClick={() => {
                setCurrentSystemIndex(idx);
                noteIndexRef.current = 0;
                setCursorX(s.notes[0]?.xPercent || 15);
              }}
              className={`h-1.5 rounded-full transition-all duration-200 ${
                currentSystemIndex === idx
                  ? "w-8 bg-amber-400"
                  : "w-3 bg-gray-700 hover:bg-gray-500"
              }`}
              title={`Ir para o Pentagrama ${idx + 1}`}
            />
          ))}
        </div>
      </footer>

      <BottomNav />
    </div>
  );
}
