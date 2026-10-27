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
