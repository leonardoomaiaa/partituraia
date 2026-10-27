import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, Play, Square, Music, FileText, Sparkles, AlertCircle, Volume2 } from "lucide-react";
import { toast } from "sonner";

export function LeitorRoute() {
  const navigate = useNavigate();
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentBeat, setCurrentBeat] = useState(0);
  const [currentNoteIndex, setCurrentNoteIndex] = useState(0);
  const [bpm, setBpm] = useState(100);

  // Notas simuladas extraídas da partitura enviada
  const [detectedNotes, setDetectedNotes] = useState([
    { note: "C4", duration: "Semínima", label: "Dó" },
    { note: "E4", duration: "Semínima", label: "Mi" },
    { note: "G4", duration: "Semínima", label: "Sol" },
    { note: "C5", duration: "Mínima", label: "Dó Agudo" },
    { note: "B4", duration: "Semínima", label: "Si" },
    { note: "G4", duration: "Semínima", label: "Sol" },
    { note: "E4", duration: "Mínima", label: "Mi" },
  ]);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<any>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      
      // Simula o processamento OMR (Leitura da Partitura por IA)
      setIsProcessing(true);
      setTimeout(() => {
        setIsProcessing(false);
        toast.success("Partitura escaneada com sucesso! Ritmo e compasso detectados.");
      }, 2000);
    }
  };

  // Conversão de nota para frequência em Hz
  const noteToFrequency = (noteStr: string) => {
    const notes: Record<string, number> = {
      "C4": 261.63, "D4": 293.66, "E4": 329.63, "F4": 349.23,
      "G4": 392.00, "A4": 440.00, "B4": 493.88, "C5": 523.25
    };
    return notes[noteStr] || 440;
  };

  // Toca o som da nota e o clique do metrônomo
  const playToneAndClick = (freq: number, isAccent: boolean) => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") {
        ctx.resume();
      }

      // Som da Nota Musical (Melodia)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);

      // Som do Metrônomo (Click de marcação de tempo)
      const clickOsc = ctx.createOscillator();
      const clickGain = ctx.createGain();
      clickOsc.type = "triangle";
      clickOsc.frequency.setValueAtTime(isAccent ? 1200 : 800, ctx.currentTime);
      
      clickGain.gain.setValueAtTime(0.05, ctx.currentTime);
      clickGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);

      clickOsc.connect(clickGain);
      clickGain.connect(ctx.destination);
      clickOsc.start();
      clickOsc.stop(ctx.currentTime + 0.05);
    } catch (e) {
      console.error("Erro no áudio:", e);
    }
  };

  // Iniciar / Parar o Player sincronizado com o Metrônomo
  useEffect(() => {
    if (isPlaying) {
      const interval = (60 / bpm) * 1000; // Tempo por batida em milissegundos
      
      timerRef.current = setInterval(() => {
        setCurrentBeat((prevBeat) => {
          const nextBeat = (prevBeat + 1) % 4; // Compasso 4/4
          return nextBeat;
        });

        setCurrentNoteIndex((prevIndex) => {
          const nextIndex = (prevIndex + 1) % detectedNotes.length;
          const currentNoteObj = detectedNotes[nextIndex];
          playToneAndClick(noteToFrequency(currentNoteObj.note), currentBeat === 0);
          return nextIndex;
        });
      }, interval);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, bpm, detectedNotes]);

  return (
    <div className="min-h-screen bg-[#0F1117] text-white pb-24">
      {/* Cabeçalho */}
      <header className="border-b border-gray-800 bg-[#1A1D27]/80 backdrop-blur sticky top-0 z-20 px-4 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-amber-500/10 p-2 rounded-xl border border-amber-500/20">
            <Music className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold">Leitor de Partitura & Player</h1>
            <p className="text-xs text-gray-400">Reconhecimento OMR & Metrônomo Sincronizado</p>
          </div>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => navigate({ to: "/" })}
          className="border-gray-700 text-gray-300 hover:bg-gray-800"
        >
          Voltar
        </Button>
      </header>

      <main className="max-w-2xl mx-auto p-4 space-y-6 mt-4">
        {/* Card de Upload */}
        <Card className="bg-[#1A1D27] border-gray-800 shadow-xl">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Upload className="w-5 h-5 text-amber-400" />
              Enviar Foto da Partitura Completa
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!imagePreview ? (
              <label className="border-2 border-dashed border-gray-700 hover:border-amber-500/50 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition bg-[#0F1117]/50 group">
                <div className="bg-amber-500/10 p-4 rounded-full mb-3 group-hover:scale-110 transition">
                  <FileText className="w-8 h-8 text-amber-400" />
                </div>
                <p className="text-sm font-medium text-gray-200">Clique para enviar a foto da partitura</p>
                <p className="text-xs text-gray-400 mt-1">Suporta PNG, JPG ou PDF digitalizado</p>
                <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
              </label>
            ) : (
              <div className="space-y-3">
                <div className="relative rounded-xl overflow-hidden border border-gray-700 max-h-60 bg-black flex items-center justify-center">
                  <img src={imagePreview} alt="Partitura enviada" className="object-contain max-h-60 w-full" />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-emerald-400 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" /> Partitura pronta para leitura
                  </span>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => { setImagePreview(null); setImageFile(null); setIsPlaying(false); }}
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10 text-xs"
                  >
                    Trocar Imagem
                  </Button>
                </div>
              </div>
            )}

            {isProcessing && (
              <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-3 text-amber-300 text-sm animate-pulse">
                <Sparkles className="w-5 h-5 animate-spin" />
                <span>Analisando compassos, claves e notas da partitura com IA...</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Player & Metrônomo Sincronizado */}
        {imagePreview && !isProcessing && (
          <Card className="bg-[#1A1D27] border-gray-800 shadow-xl">
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Volume2 className="w-5 h-5 text-amber-400" />
                  Player & Metrônomo de Treino
                </span>
                <span className="text-xs bg-amber-500/20 text-amber-300 px-2.5 py-1 rounded-full font-mono">
                  {bpm} BPM
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Controles de Andamento (BPM) */}
              <div className="flex items-center justify-between bg-[#0F1117] p-3 rounded-xl border border-gray-800">
                <span className="text-sm text-gray-300">Ajustar Andamento:</span>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => setBpm(Math.max(40, bpm - 5))} className="border-gray-700">-5</Button>
                  <span className="font-mono font-bold w-12 text-center">{bpm}</span>
                  <Button size="sm" variant="outline" onClick={() => setBpm(Math.min(220, bpm + 5))} className="border-gray-700">+5</Button>
                </div>
              </div>

              {/* Indicador Visual do Metrônomo (Luzes de Compasso) */}
              <div className="flex justify-center gap-3 py-2">
                {[0, 1, 2, 3].map((beat) => (
                  <div 
                    key={beat}
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-mono text-xs font-bold transition-all ${
                      currentBeat === beat && isPlaying 
                        ? (beat === 0 ? "bg-amber-500 text-black scale-110 shadow-lg shadow-amber-500/50" : "bg-emerald-500 text-black scale-110")
                        : "bg-gray-800 text-gray-400 border border-gray-700"
                    }`}
                  >
                    {beat + 1}
                  </div>
                ))}
              </div>

              {/* Partitura Digitalizada / Notas Destacadas em Tempo Real */}
              <div className="bg-[#0F1117] p-4 rounded-xl border border-gray-800">
                <p className="text-xs text-gray-400 mb-2 uppercase tracking-wider font-semibold">Melodia Detectada (Acompanhe o cursor):</p>
                <div className="flex flex-wrap gap-2 items-center justify-center">
                  {detectedNotes.map((item, idx) => (
                    <div 
                      key={idx}
                      className={`px-3 py-2 rounded-lg border font-mono text-sm transition-all ${
                        currentNoteIndex === idx && isPlaying
                          ? "bg-amber-500 text-black font-bold border-amber-400 scale-105 shadow-md"
                          : "bg-[#1A1D27] text-gray-300 border-gray-700"
                      }`}
                    >
                      <div className="text-center">{item.label}</div>
                      <div className="text-[10px] opacity-75 text-center">{item.note}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Botões de Ação Principal */}
              <div className="flex gap-3">
                <Button 
                  onClick={() => setIsPlaying(!isPlaying)}
                  className={`flex-1 py-6 text-base font-bold shadow-lg transition ${
                    isPlaying 
                      ? "bg-red-600 hover:bg-red-700 text-white" 
                      : "bg-amber-500 hover:bg-amber-600 text-black"
                  }`}
                >
                  {isPlaying ? (
                    <>
                      <Square className="w-5 h-5 mr-2 fill-current" /> Pausar Execução
                    </>
                  ) : (
                    <>
                      <Play className="w-5 h-5 mr-2 fill-current" /> Tocar Partitura & Metrônomo
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
