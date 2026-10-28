import React, { useState, useEffect, useRef } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
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
  KeyRound,
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
  isRest: boolean;
}

interface StaffSystem {
  id: number;
  topPercent: number;
  heightPercent: number;
  notes: NoteEvent[];
}

function LeitorRoute() {
  const navigate = useNavigate();

  // Estados de Imagem e API
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [apiKey, setApiKey] = useState<string>(() => localStorage.getItem("GEMINI_API_KEY") || "");
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [scoreTitle, setScoreTitle] = useState("Leitor Inteligente OMR");

  // Estrutura de Pentagramas
  const [systems, setSystems] = useState<StaffSystem[]>([]);
  const [currentSystemIndex, setCurrentSystemIndex] = useState(0);
  const [currentNoteIndex, setCurrentNoteIndex] = useState(0);

  // Estados de Reprodução
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(84);
  const [transposeSemi, setTransposeSemi] = useState(0);
  const [volume, setVolume] = useState(85);
  const [isMuted, setIsMuted] = useState(false);
  const [instrument, setInstrument] = useState<"sax" | "piano" | "organ">("sax");
  const [showMixer, setShowMixer] = useState(false);

  // Posição visual
  const [cursorX, setCursorX] = useState(15);
  const [currentBeat, setCurrentBeat] = useState(0);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const playbackTimerRef = useRef<any>(null);

  const handleSaveApiKey = (val: string) => {
    const trimmed = val.trim();
    setApiKey(trimmed);
    localStorage.setItem("GEMINI_API_KEY", trimmed);
    setShowKeyModal(false);
    toast.success("Chave de API guardada com sucesso!");
  };

  const compressImageForAI = (dataUrl: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxDim = 1200;
        let w = img.width;
        let h = img.height;

        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }

        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL("image/jpeg", 0.78));
        } else {
          resolve(dataUrl);
        }
      };
      img.src = dataUrl;
    });
  };

  // Descoberta dinâmica do modelo ativo da sua conta + Leitura OMR
  const analyzeWithVisionAI = async (rawImage: string) => {
    if (!apiKey) {
      setShowKeyModal(true);
      toast.info("Insira a sua chave de API para o reconhecimento inteligente.");
      return;
    }

    setIsProcessing(true);

    try {
      const compressed = await compressImageForAI(rawImage);
      const cleanBase64 = compressed.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "");

      // 1. Consulta os modelos ativos permitidos para a sua chave
      let activeModelName = "gemini-2.0-flash";
      try {
        const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const listData = await listRes.json();
        if (listData?.models && Array.isArray(listData.models)) {
          const supported = listData.models.find(
            (m: any) =>
              m.supportedGenerationMethods?.includes("generateContent") &&
              (m.name.includes("flash") || m.name.includes("pro"))
          );
          if (supported) {
            activeModelName = supported.name.replace("models/", "");
          }
        }
      } catch (err) {
        console.warn("Utilizando modelo padrão flash:", err);
      }

      const promptText = `Você é um motor especialista em Optical Music Recognition (OMR).
Analise a partitura na imagem enviada com máximo rigor e retorne APENAS um JSON válido no formato abaixo, sem texto adicional:
{
  "title": "Título da Música",
  "bpm": 80,
  "systems": [
    {
      "id": 1,
      "topPercent": 14.0,
      "heightPercent": 7.0,
      "notes": [
        { "noteName": "G4", "frequency": 392.0, "durationBeats": 1.0, "xPercent": 25, "isRest": false }
      ]
    }
  ]
}

Regras:
1. "systems": lista de cada pentagrama presente na imagem do topo até o fim.
2. "topPercent": porcentagem vertical (0-100) do pentagrama na folha.
3. "heightPercent": altura vertical (0-100) do pentagrama.
4. "notes": notas na ordem cronológica de leitura com frequências em Hz afinadas, durações em tempos (1.0 = semínima, 0.5 = colcheia, etc.), posição xPercent e isRest (true para pausa).`;

      // 2. Chamada com o modelo descoberto
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${activeModelName}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: promptText },
                  {
                    inlineData: {
                      mimeType: "image/jpeg",
                      data: cleanBase64,
                    },
                  },
                ],
              },
            ],
          }),
        }
      );

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error.message || "Erro retornado pela API Gemini.");
      }

      let rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) {
        throw new Error("A IA não retornou o formato esperado.");
      }

      rawText = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(rawText);

      if (parsed.title) setScoreTitle(parsed.title);
      if (parsed.bpm && typeof parsed.bpm === "number") setBpm(parsed.bpm);

      if (parsed.systems && Array.isArray(parsed.systems) && parsed.systems.length > 0) {
        setSystems(parsed.systems);
        setCurrentSystemIndex(0);
        setCurrentNoteIndex(0);
        if (parsed.systems[0]?.notes?.[0]) {
          setCursorX(parsed.systems[0].notes[0].xPercent || 15);
        }
        toast.success("Partitura Interpretada com Sucesso!", {
          description: `${parsed.systems.length} pentagramas reconhecidos via ${activeModelName}.`,
        });
      } else {
        throw new Error("Nenhum sistema musical detectado.");
      }
    } catch (err: any) {
      console.error("Erro na API de Visão:", err);
      toast.error(err.message || "Falha ao processar a partitura.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setImagePreview(result);
        analyzeWithVisionAI(result);
      };
      reader.readAsDataURL(file);
    }
  };

  const playSynthesizedTone = (freqHz: number, durationSec: number, isRest: boolean) => {
    if (isMuted || isRest || !freqHz || freqHz === 0) return;
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

      const targetVol = (volume / 100) * 0.25;
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(targetVol, ctx.currentTime + 0.03);
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

    playSynthesizedTone(note.frequency, durationSec, note.isRest);

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
  }, [isPlaying, bpm, transposeSemi, instrument, isMuted, volume]);

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
              Pentagrama {currentSystemIndex + 1}/{systems.length || 1} • {activeNote ? (activeNote.isRest ? "Pausa" : `Nota: ${activeNote.noteName}`) : "Pronto para tocar"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowKeyModal(true)}
            className="h-8 w-8 text-gray-400 hover:text-white"
            title="Configurar Chave API"
          >
            <KeyRound className="w-4 h-4" />
          </Button>

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

      <main className="flex-1 relative flex items-center justify-center p-2 overflow-hidden bg-[#050608]">
        {!imagePreview ? (
          <div className="w-full max-w-sm p-6 border-2 border-dashed border-gray-800 rounded-2xl bg-[#0F121A] flex flex-col items-center justify-center text-center">
            <div className="p-3 rounded-full bg-emerald-500/10 text-emerald-400 mb-3">
              <FileMusic className="w-8 h-8" />
            </div>
            <h2 className="text-sm font-semibold mb-1">Reconhecimento OMR por IA</h2>
            <p className="text-[11px] text-gray-400 mb-4 max-w-xs">
              Envie fotos ou digitalizações de partituras para interpretação rigorosa das notas, pausas e pautas.
            </p>
            <label className="cursor-pointer">
              <Button asChild size="sm" className="bg-emerald-500 hover:bg-emerald-600 text-black font-semibold">
                <span className="flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5" /> Selecionar Imagem
                </span>
              </Button>
              <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>
        ) : (
          <div className="relative w-full max-w-xl max-h-[76vh] h-full rounded-md overflow-hidden border border-gray-800 bg-white flex items-center justify-center shadow-2xl">
            <img
              src={imagePreview}
              alt="Partitura"
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
              <div className="absolute inset-0 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center gap-2 z-20">
                <Sparkles className="w-8 h-8 text-emerald-400 animate-spin" />
                <p className="text-xs font-semibold text-emerald-200">A IA está a descodificar cada compasso e nota...</p>
              </div>
            )}
          </div>
        )}

        {showKeyModal && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-[#141722] border border-gray-700 p-5 rounded-2xl w-full max-w-sm space-y-3">
              <h3 className="text-sm font-bold flex items-center gap-2 text-white">
                <KeyRound className="w-4 h-4 text-emerald-400" /> Chave de Visão Inteligente
              </h3>
              <p className="text-xs text-gray-400">
                Insira a sua chave da API do Google AI Studio para permitir a análise musical precisa por IA.
              </p>
              <Input
                type="password"
                placeholder="Cole a sua API Key aqui"
                defaultValue={apiKey}
                id="api-key-input"
                className="bg-[#090B10] border-gray-700 text-xs text-white"
              />
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowKeyModal(false)}
                  className="text-gray-400 text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    const el = document.getElementById("api-key-input") as HTMLInputElement;
                    handleSaveApiKey(el.value);
                  }}
                  className="bg-emerald-500 hover:bg-emerald-600 text-black text-xs font-bold"
                >
                  Salvar
                </Button>
              </div>
            </div>
          </div>
        )}

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

        <div className="flex items-center justify-center gap-1 pt-0.5 overflow-x-auto">
          {systems.map((s, idx) => (
            <button
              key={s.id}
              onClick={() => {
                if (playbackTimerRef.current) clearTimeout(playbackTimerRef.current);
                setCurrentSystemIndex(idx);
                setCurrentNoteIndex(0);
                setCursorX(s.notes[0]?.xPercent || 15);
              }}
              className={`h-1.5 rounded-full transition-all duration-200 ${
                currentSystemIndex === idx
                  ? "w-6 bg-emerald-400"
                  : "w-2 bg-gray-700 hover:bg-gray-500"
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
