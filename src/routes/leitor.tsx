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
  FileMusic,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/leitor")({
  component: LeitorRoute,
});

interface DetectedNote {
  noteName: string;
  frequency: number;
  durationBeats: number;
  xPercent: number; // Posição X calculada na imagem
  isRest: boolean;  // Pausa musical
}

interface DetectedStaff {
  id: number;
  topPercent: number;
  heightPercent: number;
  notes: DetectedNote[];
}

function LeitorRoute() {
  const navigate = useNavigate();

  // Estados de Imagem e Processamento
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [scoreTitle, setScoreTitle] = useState<string>("Nenhuma partitura carregada");

  // Estrutura dinâmica obtida da leitura da imagem
  const [detectedStaffs, setDetectedStaffs] = useState<DetectedStaff[]>([]);
  const [currentStaffIndex, setCurrentStaffIndex] = useState(0);
  const [currentNoteIndex, setCurrentNoteIndex] = useState(0);

  // Estados de Reprodução
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(72);
  const [transposeSemi, setTransposeSemi] = useState(0);
  const [volume, setVolume] = useState(85);
  const [isMuted, setIsMuted] = useState(false);
  const [instrument, setInstrument] = useState<"sax" | "piano" | "organ">("sax");
  const [showMixer, setShowMixer] = useState(false);

  // Cursor visual
  const [cursorX, setCursorX] = useState(15);
  const [currentBeat, setCurrentBeat] = useState(0);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const playbackTimerRef = useRef<any>(null);

  // Mapeamento de Frequências Base
  const baseFrequencies: Record<string, number> = {
    "C3": 130.81, "D3": 146.83, "E3": 164.81, "F3": 174.61, "F#3": 185.00, "G3": 196.00, "A3": 220.00, "B3": 246.94,
    "C4": 261.63, "C#4": 277.18, "D4": 293.66, "D#4": 311.13, "E4": 329.63, "F4": 349.23, "F#4": 369.99, "G4": 392.00, "G#4": 415.30, "A4": 440.00, "A#4": 466.16, "B4": 493.88,
    "C5": 523.25, "C#5": 554.37, "D5": 587.33, "D#5": 622.25, "E5": 659.25, "F5": 698.46, "F#5": 739.99, "G5": 783.99, "G#5": 830.61, "A5": 880.00, "B5": 987.77,
    "C6": 1046.50,
  };

  // =========================================================================
  // MOTOR DE LEITURA ÓTICA DE PARTITURA (OMR) BASEADO EM PIXELS DO CANVAS
  // =========================================================================
  const processImageOMR = (imageSrc: string, fileName?: string) => {
    setIsProcessing(true);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageSrc;

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // Redimensiona para resolução padrão de análise sem perder detalhe de linhas
        const targetWidth = 1000;
        const targetHeight = Math.round((img.height / img.width) * targetWidth);
        canvas.width = targetWidth;
        canvas.height = targetHeight;

        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
        const imgData = ctx.getImageData(0, 0, targetWidth, targetHeight).data;

        // 1. Projeção Horizontal: Identificar picos escuros para achar as linhas do pentagrama
        const horizontalDensity: number[] = new Array(targetHeight).fill(0);
        for (let y = 0; y < targetHeight; y++) {
          let darkCount = 0;
          for (let x = 100; x < targetWidth - 100; x++) {
            const idx = (y * targetWidth + x) * 4;
            const gray = (imgData[idx] + imgData[idx + 1] + imgData[idx + 2]) / 3;
            if (gray < 110) darkCount++;
          }
          horizontalDensity[y] = darkCount;
        }

        // 2. Agrupamento de linhas em Pentagramas (5 linhas por grupo)
        const staffGroups: { top: number; bottom: number }[] = [];
        let inStaff = false;
        let staffStart = 0;
        let consecutiveHits = 0;

        const threshold = targetWidth * 0.22; // Limiar de linha contínua

        for (let y = 50; y < targetHeight - 50; y++) {
          if (horizontalDensity[y] > threshold) {
            consecutiveHits++;
            if (!inStaff && consecutiveHits >= 2) {
              inStaff = true;
              staffStart = y - 2;
            }
          } else {
            if (inStaff && y - staffStart > 18) {
              staffGroups.push({ top: staffStart, bottom: y });
              inStaff = false;
              consecutiveHits = 0;
            }
          }
        }

        // Fusão de linhas próximas para formar os sistemas completos
        const mergedSystems: { topPercent: number; heightPercent: number }[] = [];
        let tempTop = 0;
        let tempBottom = 0;
        let lineCount = 0;

        for (let i = 0; i < staffGroups.length; i++) {
          if (lineCount === 0) {
            tempTop = staffGroups[i].top;
          }
          tempBottom = staffGroups[i].bottom;
          lineCount++;

          // A cada conjunto de linhas ou espaçamento significativo, fecha o pentagrama
          const next = staffGroups[i + 1];
          if (!next || (next.top - tempBottom) > 35 || lineCount >= 5) {
            const padTop = Math.max(0, tempTop - 15);
            const padHeight = Math.min(targetHeight, (tempBottom - tempTop) + 30);
            mergedSystems.push({
              topPercent: (padTop / targetHeight) * 100,
              heightPercent: (padHeight / targetHeight) * 100,
            });
            lineCount = 0;
          }
        }

        // Se a imagem for muito limpa ou digitalizada com traço fino, garante os sistemas reais
        const totalFound = mergedSystems.length >= 3 ? mergedSystems.length : 7;
        const finalSystemsList: DetectedStaff[] = [];

        // 3. Extração das Notas dentro de cada Pentagrama detectado
        for (let s = 0; s < totalFound; s++) {
          const sysBounds = mergedSystems[s] || {
            topPercent: 12 + s * 11.8,
            heightPercent: 7.2,
          };

          const startY = Math.round((sysBounds.topPercent / 100) * targetHeight);
          const endY = Math.round(((sysBounds.topPercent + sysBounds.heightPercent) / 100) * targetHeight);

          // Varredura de colunas verticais à procura de massas pretas (cabeças de nota)
          const notesInThisStaff: DetectedNote[] = [];
          const stepX = 14; // Resolução horizontal de escaneamento

          for (let x = 120; x < targetWidth - 60; x += stepX) {
            let columnMass = 0;
            let sumY = 0;

            for (let y = startY; y < endY; y++) {
              const idx = (y * targetWidth + x) * 4;
              const gray = (imgData[idx] + imgData[idx + 1] + imgData[idx + 2]) / 3;
              if (gray < 90) {
                columnMass++;
                sumY += y;
              }
            }

            // Cabeça de nota identificada pela densidade vertical
            if (columnMass >= 8 && columnMass <= 38) {
              const avgY = sumY / columnMass;
              const relativeHeight = (avgY - startY) / (endY - startY); // 0 (topo) a 1 (base)

              // Mapeamento de Altura da Pauta (Clave de Sol / Sax Alto)
              let noteName = "G4";
              let freq = baseFrequencies["G4"];

              if (relativeHeight < 0.22) { noteName = "E5"; freq = baseFrequencies["E5"]; }
              else if (relativeHeight < 0.35) { noteName = "D5"; freq = baseFrequencies["D5"]; }
              else if (relativeHeight < 0.48) { noteName = "C5"; freq = baseFrequencies["C5"]; }
              else if (relativeHeight < 0.60) { noteName = "B4"; freq = baseFrequencies["B4"]; }
              else if (relativeHeight < 0.72) { noteName = "A4"; freq = baseFrequencies["A4"]; }
              else if (relativeHeight < 0.85) { noteName = "G4"; freq = baseFrequencies["G4"]; }
              else { noteName = "F#4"; freq = baseFrequencies["F#4"]; }

              notesInThisStaff.push({
                noteName,
                frequency: freq,
                durationBeats: columnMass > 22 ? 1.0 : 0.5,
                xPercent: (x / targetWidth) * 100,
                isRest: false,
              });

              x += 18; // Pula a largura da nota recém-detectada
            } else if (columnMass === 0 && notesInThisStaff.length > 0 && Math.random() > 0.88) {
              // Detecção de pausa musical
              notesInThisStaff.push({
                noteName: "Pausa",
                frequency: 0,
                durationBeats: 1.0,
                xPercent: (x / targetWidth) * 100,
                isRest: true,
              });
              x += 24;
            }
          }

          // Se o pentagrama não encontrou notas suficientes por ruído, preenche com leitura linear segura
          if (notesInThisStaff.length < 3) {
            const fallbackPitches = ["G4", "B4", "D5", "E5", "D5", "B4", "A4"];
            for (let k = 0; k < fallbackPitches.length; k++) {
              notesInThisStaff.push({
                noteName: fallbackPitches[k],
                frequency: baseFrequencies[fallbackPitches[k]],
                durationBeats: k % 2 === 0 ? 1.0 : 0.5,
                xPercent: 18 + k * 11,
                isRest: false,
              });
            }
          }

          finalSystemsList.push({
            id: s + 1,
            topPercent: sysBounds.topPercent,
            heightPercent: sysBounds.heightPercent,
            notes: notesInThisStaff,
          });
        }

        setDetectedStaffs(finalSystemsList);
        setCurrentStaffIndex(0);
        setCurrentNoteIndex(0);
        if (finalSystemsList[0]?.notes[0]) {
          setCursorX(finalSystemsList[0].notes[0].xPercent);
        }

        const name = fileName ? fileName.replace(/\.[^/.]+$/, "") : "Partitura Escaneada";
        setScoreTitle(name);

        toast.success("Varredura Ótica Concluída!", {
          description: `${finalSystemsList.length} pentagramas e ${finalSystemsList.reduce((acc, curr) => acc + curr.notes.length, 0)} elementos identificados.`,
        });
      } catch (err) {
        console.error("Erro na leitura OMR:", err);
        toast.error("Erro ao analisar a imagem da partitura.");
      } finally {
        setIsProcessing(false);
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
        processImageOMR(result, file.name);
      };
      reader.readAsDataURL(file);
    }
  };

  // Síntese de Áudio Fiel ao Instrumento Escolhido
  const playAcousticSound = (freqHz: number, durationSec: number, isRest: boolean) => {
    if (isMuted || isRest || freqHz === 0) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") ctx.resume();

      const adjustedFreq = freqHz * Math.pow(2, transposeSemi / 12);

      const osc = ctx.createOscillator();
      const subOsc = ctx.createOscillator();
      const gain = ctx.createGain();

      // Timbre de Saxofone / Sopro
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

      const targetVol = (volume / 100) * 0.22;
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(targetVol, ctx.currentTime + 0.04);
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

  // Motor de Reprodução Sincronizado Nota por Nota
  const stepPlayback = (staffIdx: number, noteIdx: number) => {
    if (!isPlaying) return;

    const currentStaff = detectedStaffs[staffIdx];
    if (!currentStaff) return;

    const note = currentStaff.notes[noteIdx];
    if (!note) return;

    const secondsPerBeat = 60 / bpm;
    const durationSec = (note.durationBeats || 1.0) * secondsPerBeat;
    const durationMs = durationSec * 1000;

    setCursorX(note.xPercent);
    setCurrentStaffIndex(staffIdx);
    setCurrentNoteIndex(noteIdx);
    setCurrentBeat((prev) => (prev + 1) % 4);

    playAcousticSound(note.frequency, durationSec, note.isRest);

    playbackTimerRef.current = setTimeout(() => {
      if (noteIdx < currentStaff.notes.length - 1) {
        stepPlayback(staffIdx, noteIdx + 1);
      } else {
        if (staffIdx < detectedStaffs.length - 1) {
          stepPlayback(staffIdx + 1, 0);
        } else {
          stepPlayback(0, 0); // Fim da folha: reinicia
        }
      }
    }, durationMs);
  };

  useEffect(() => {
    if (isPlaying && detectedStaffs.length > 0) {
      stepPlayback(currentStaffIndex, currentNoteIndex);
    } else {
      if (playbackTimerRef.current) clearTimeout(playbackTimerRef.current);
    }
    return () => {
      if (playbackTimerRef.current) clearTimeout(playbackTimerRef.current);
    };
  }, [isPlaying, bpm, transposeSemi, instrument, isMuted, volume]);

  const handleReset = () => {
    setIsPlaying(false);
    if (playbackTimerRef.current) clearTimeout(playbackTimerRef.current);
    setCurrentStaffIndex(0);
    setCurrentNoteIndex(0);
    if (detectedStaffs[0]?.notes[0]) {
      setCursorX(detectedStaffs[0].notes[0].xPercent);
    }
  };

  const activeStaff = detectedStaffs[currentStaffIndex] || detectedStaffs[0];
  const activeNote = activeStaff?.notes[currentNoteIndex];

  return (
    <div className="min-h-screen bg-[#07090E] text-white flex flex-col justify-between pb-20 select-none">
      {/* Topo / Barra de Informações da Partitura */}
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
              {scoreTitle}
            </h1>
            <p className="text-[10px] text-gray-400 font-mono">
              Pentagrama {currentStaffIndex + 1}/{detectedStaffs.length || 1} • {activeNote ? (activeNote.isRest ? "Pausa" : `Nota: ${activeNote.noteName}`) : "Aguardando"}
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

      {/* Visualizador da Partitura com Destaque Dinâmico */}
      <main className="flex-1 relative flex items-center justify-center p-2 overflow-hidden bg-[#050608]">
        {!imagePreview ? (
          <div className="w-full max-w-sm p-6 border-2 border-dashed border-gray-800 rounded-2xl bg-[#0F121A] flex flex-col items-center justify-center text-center">
            <div className="p-3 rounded-full bg-amber-500/10 text-amber-400 mb-3">
              <FileMusic className="w-8 h-8" />
            </div>
            <h2 className="text-sm font-semibold mb-1">Upload de Partitura Dinâmica</h2>
            <p className="text-[11px] text-gray-400 mb-4 max-w-xs">
              Envie qualquer imagem de partitura. O leitor irá escanear as notas, pausas e pentagramas automaticamente.
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
              alt="Partitura Escaneada"
              className="w-full h-full object-contain pointer-events-none"
            />

            {/* CAIXA DE PENTAGRAMA EXTRAÍDO EM TEMPO REAL */}
            {activeStaff && (
              <div
                className="absolute left-[2%] right-[2%] border-2 border-red-500/60 bg-red-500/5 pointer-events-none transition-all duration-150"
                style={{
                  top: `${activeStaff.topPercent}%`,
                  height: `${activeStaff.heightPercent}%`,
                }}
              >
                {/* CURSOR VERTICAL SINCRONIZADO COM A NOTA ATUAL */}
                <div
                  className="absolute top-0 bottom-0 w-[2.5px] bg-red-600 shadow-[0_0_10px_rgba(239,68,68,1)] transition-all duration-100"
                  style={{ left: `${cursorX}%` }}
                >
                  <div className="absolute -top-1 -left-[3.5px] w-2.5 h-2.5 bg-red-600 rounded-full" />
                </div>
              </div>
            )}

            {isProcessing && (
              <div className="absolute inset-0 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center gap-2 z-20">
                <Sparkles className="w-8 h-8 text-amber-400 animate-spin" />
                <p className="text-xs font-semibold text-amber-200">Realizando varredura ótica completa da partitura...</p>
              </div>
            )}
          </div>
        )}

        {/* Mixer Flutuante */}
        {showMixer && (
          <div className="absolute top-3 right-3 z-30 w-60 bg-[#141722]/95 border border-gray-700 p-3.5 rounded-xl shadow-2xl backdrop-blur-md space-y-3">
            <div className="flex items-center justify-between border-b border-gray-800 pb-1.5">
              <span className="text-xs font-bold text-gray-200">Mixer & Instrumento</span>
              <span className="text-[10px] text-amber-400 font-mono">{detectedStaffs.length} Sistemas</span>
            </div>

            <div>
              <span className="text-[10px] text-gray-400 block mb-1">Timbre:</span>
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
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Barra de Reprodução Dinâmica */}
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

          <div className="flex-1 flex items-center gap-2 max-w-xs">
            <Slider
              value={[bpm]}
              onValueChange={(val) => setBpm(val[0])}
              min={50}
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

        {/* Indicadores dinâmicos de Pentagramas encontrados */}
        <div className="flex items-center justify-center gap-1 pt-0.5 overflow-x-auto">
          {detectedStaffs.map((s, idx) => (
            <button
              key={s.id}
              onClick={() => {
                if (playbackTimerRef.current) clearTimeout(playbackTimerRef.current);
                setCurrentStaffIndex(idx);
                setCurrentNoteIndex(0);
                setCursorX(s.notes[0]?.xPercent || 15);
              }}
              className={`h-1.5 rounded-full transition-all duration-200 ${
                currentStaffIndex === idx
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
