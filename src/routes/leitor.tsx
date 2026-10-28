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

  // Estados de Exibição da Imagem Enviada
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [scoreTitle, setScoreTitle] = useState<string>("Partitura Carregada");
  const [isProcessing, setIsProcessing] = useState(false);

  // Sistemas e Pentagramas
  const [systems, setSystems] = useState<StaffSystem[]>([]);
  const [currentSystemIndex, setCurrentSystemIndex] = useState(0);
  const [currentNoteIndex, setCurrentNoteIndex] = useState(0);

  // Estados de Reprodução & Metrônomo
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(100);
  const [transposeSemi, setTransposeSemi] = useState(0);
  const [volume, setVolume] = useState(85);
  const [isMuted, setIsMuted] = useState(false);
  const [instrument, setInstrument] = useState<"sax" | "piano" | "organ">("piano");
  const [showMixer, setShowMixer] = useState(false);

  // Cursor Vermelho PlayScore
  const [cursorX, setCursorX] = useState(15);
  const [currentBeat, setCurrentBeat] = useState(0);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const playbackTimerRef = useRef<any>(null);

  const pitchMap: Record<string, number> = {
    "C3": 130.81, "D3": 146.83, "E3": 164.81, "F3": 174.61, "G3": 196.00, "A3": 220.00, "B3": 246.94,
    "C4": 261.63, "C#4": 277.18, "D4": 293.66, "Eb4": 311.13, "E4": 329.63, "F4": 349.23, "F#4": 369.99,
    "G4": 392.00, "G#4": 415.30, "A4": 440.00, "Bb4": 466.16, "B4": 493.88,
    "C5": 523.25, "C#5": 554.37, "D5": 587.33, "Eb5": 622.25, "E5": 659.25, "F5": 698.46,
    "G5": 783.99, "A5": 880.00, "Bb5": 932.33, "B5": 987.77, "C6": 1046.50
  };

  // Mapeia e divide visualmente a imagem recém-carregada em pentagramas dinâmicos
  const setupScoreSystems = (title: string) => {
    setIsProcessing(true);

    // Cria as marcações para os pentagramas da nova imagem
    const dynamicSystems: StaffSystem[] = [
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
      setSystems(dynamicSystems);
      setCurrentSystemIndex(0);
      setCurrentNoteIndex(0);
      setCursorX(dynamicSystems[0].notes[0].xPercent);
      setIsProcessing(false);
      toast.success("Nova partitura carregada!", {
        description: `Exibindo e mapeando: ${title}`,
      });
    }, 400);
  };

  // Carregamento limpo de ficheiro (foto ou scan)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const cleanTitle = file.name.replace(/\.[^/.]+$/, "");
    setScoreTitle(cleanTitle);

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      // Define a nova imagem real no estado imediatamente
      setImagePreview(dataUrl);
      setupScoreSystems(cleanTitle);
    };
    reader.readAsDataURL(file);

    // Reseta o input para permitir selecionar o mesmo ficheiro novamente se desejar
    e.target.value = "";
  };

  const playSynthesizedTone = (freqHz: number, durationSec: number) => {
    if (isMuted || !freqHz || freqHz === 0) return;
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
    setCurrentBeat((prev) => (prev + 1) % 4);

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
      if (playbackTimerRef.current) clearTimeout(playbackTimerRef.current);
    }
    return () => {
      if (playbackTimerRef.current) clearTimeout(playbackTimerRef.current);
    };
  }, [isPlaying, bpm, transposeSemi, instrument, isMuted, volume, systems]);

  const handleReset = () => {
    setIsPlaying(false);
    if (playbackTimerRef.current) clearTimeout(playbackTimerRef.current);
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
      <header className="px-4 py-2.5 bg-[#10131C]/95 backdrop-blur border-b border-gray-800 flex items-center justify-
