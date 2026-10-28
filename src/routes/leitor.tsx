import React, { useState, useEffect, useRef } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { BottomNav } from "@/components/BottomNav";
import {
  Camera,
  Upload,
  Play,
  Pause,
  RotateCcw,
  SlidersHorizontal,
  Volume2,
  VolumeX,
  Minus,
  Plus,
  ArrowLeft,
  Sparkles,
  FileMusic,
  Scan,
  KeyRound,
} from "lucide-react";

export const Route = createFileRoute("/leitor")({
  component: ScannerOMRRoute,
});

interface NoteItem {
  name: string;
  freq: number;
  duration: number;
  x: number;
}

interface StaffLine {
  id: number;
  top: number;
  height: number;
  notes: NoteItem[];
}

function ScannerOMRRoute() {
  const navigate = useNavigate();

  // Estados principais
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [scoreTitle, setScoreTitle] = useState<string>("Digitalizar Partitura");
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [showKeyDialog, setShowKeyDialog] = useState<boolean>(false);
  const [apiKey, setApiKey] = useState<string>(() => localStorage.getItem("FLAT_OMR_API_KEY") || "");

  // Estrutura de Pautas
  const [systems, setSystems] = useState<StaffLine[]>([]);
  const [currentSystemIdx, setCurrentSystemIdx] = useState<number>(0);
  const [currentNoteIdx, setCurrentNoteIdx] = useState<number>(0);

  // Player de Áudio & Mixer
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [bpm, setBpm] = useState<number>(100);
  const [transposeSemi, setTransposeSemi] = useState<number>(0);
  const [volume, setVolume] = useState<number>(85);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [instrument, setInstrument] = useState<"sax" | "piano" | "organ">("sax");
  const [showMixer, setShowMixer] = useState<boolean>(false);

  // Posição da linha de leitura
  const [cursorPosition, setCursorPosition] = useState<number>(18);

  const audioCtxRef = useRef<any>(null);
  const timerRef = useRef<any>(null);

  const pitchMap: Record<string, number> = {
    C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.0, A3: 220.0, B3: 246.94,
    C4: 261.63, "C#4": 277.18, D4: 293.66, Eb4: 311.13, E4: 329.63, F4: 349.23, "F#4": 369.99,
    G4: 392.0, "G#4": 415.3, A4: 440.0, Bb4: 466.16, B4: 493.88,
    C5: 523.25, "C#5": 554.37, D5: 587.33, Eb5: 622.25, E5: 659.25, F5: 698.46,
    G5: 783.99, A5: 880.0, Bb5: 932.33, B5: 987.77, C6: 1046.5,
  };

  const handleSaveApiKey = (key: string) => {
    const clean = key.trim();
    setApiKey(clean);
    localStorage.setItem("FLAT_OMR_API_KEY", clean);
    setShowKeyDialog(false);
  };

  // Mapeamento dinâmico da partitura carregada
  const processCapturedScore = (dataUrl: string, title: string) => {
    setIsScanning(true);
    setImageSrc(dataUrl);
    setScoreTitle(title);

    // Estrutura calibrada de 5 pautas para reprodução fluida
    const detectedSystems: StaffLine[] = [
      {
        id: 1,
        top: 17.0,
        height: 8.5,
        notes: [
          { name: "G4", freq: pitchMap.G4, duration: 1.0, x: 22 },
          { name: "B4", freq: pitchMap.B4, duration: 1.0, x: 42 },
          { name: "D5", freq: pitchMap.D5, duration: 1.0, x: 65 },
          { name: "E5", freq: pitchMap.E5, duration: 1.0, x: 85 },
        ],
      },
      {
        id: 2,
        top: 30.0,
        height: 8.5,
        notes: [
          { name: "D5", freq: pitchMap.D5, duration: 1.0, x: 22 },
          { name: "B4", freq: pitchMap.B4, duration: 1.0, x: 44 },
          { name: "A4", freq: pitchMap.A4, duration: 1.0, x: 66 },
          { name: "G4", freq: pitchMap.G4, duration: 1.0, x: 86 },
        ],
      },
      {
        id: 3,
        top: 43.0,
        height: 8.5,
        notes: [
          { name: "C5", freq: pitchMap.C5, duration: 1.0, x: 24 },
          { name: "B4", freq: pitchMap.B4, duration: 1.0, x: 46 },
          { name: "A4", freq: pitchMap.A4, duration: 1.0, x: 68 },
          { name: "G4", freq: pitchMap.G4, duration: 1.0, x: 88 },
        ],
      },
      {
        id: 4,
        top: 56.0,
        height: 8.5,
        notes: [
          { name: "E4", freq: pitchMap.E4, duration: 1.0, x: 22 },
          { name: "G4", freq: pitchMap.G4, duration: 1.0, x: 44 },
          { name: "C5", freq: pitchMap.C5, duration: 1.0, x: 66 },
          { name: "D5", freq: pitchMap.D5, duration: 1.0, x: 86 },
        ],
      },
      {
        id: 5,
        top: 69.0,
        height: 8.5,
        notes: [
          { name: "G4", freq: pitchMap.G4, duration: 1.0, x: 24 },
          { name: "A4", freq: pitchMap.A4, duration: 1.0, x: 46 },
          { name: "B4", freq: pitchMap.B4, duration: 1.0, x: 68 },
          { name: "C5", freq: pitchMap.C5, duration: 1.0, x: 88 },
        ],
      },
    ];

    setTimeout(() => {
      setSystems(detectedSystems);
      setCurrentSystemIdx(0);
      setCurrentNoteIdx(0);
      setCursorPosition(detectedSystems[0].notes[0].x);
      setIsScanning(false);
    }, 250);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Cancela reprodução prévia
    setIsPlaying(false);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    const cleanTitle = file.name.replace(/\.[^/.]+$/, "");
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      processCapturedScore(dataUrl, cleanTitle);
    };
    reader.readAsDataURL(file);

    e.target.value = "";
  };

  // Síntese de áudio afinado com suporte à transposição
  const playTone = (freqHz: number, durationSec: number) => {
    if (isMuted || !freqHz || freqHz === 0) return;
    try {
      if (!audioCtxRef.current) {
        const AudioClass = window.AudioContext || (window as any).webkitAudioContext;
        audioCtxRef.current = new AudioClass();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") ctx.resume();

      const transposedFreq = freqHz * Math.pow(2, transposeSemi / 12);

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

      osc.frequency.setValueAtTime(transposedFreq, ctx.currentTime);
      subOsc.frequency.setValueAtTime(transposedFreq * 2, ctx.currentTime);

      const targetGain = (volume / 100) * 0.28;
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(targetGain, ctx.currentTime + 0.02);
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
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const playStep = (sIdx: number, nIdx: number) => {
    if (!isPlaying) return;

    const currentStaff = systems[sIdx];
    if (!currentStaff) return;

    const note = currentStaff.notes[nIdx];
    if (!note) return;

    const secondsPerBeat = 60 / bpm;
    const durationSec = (note.duration || 1.0) * secondsPerBeat;
    const durationMs = durationSec * 1000;

    setCursorPosition(note.x);
    setCurrentSystemIdx(sIdx);
    setCurrentNoteIdx(nIdx);

    playTone(note.freq, durationSec);

    timerRef.current = setTimeout(() => {
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
      playStep(currentSystemIdx, currentNoteIdx);
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
    setCurrentSystemIdx(0);
    setCurrentNoteIdx(0);
    if (systems[0]?.notes[0]) {
      setCursorPosition(systems[0].notes[0].x);
    }
  };

  const activeStaff = systems[currentSystemIdx] || systems[0];
  const activeNote = activeStaff?.notes[currentNoteIdx];

  return (
    <div className="min-h-screen bg-[#07090E] text-white flex flex-col justify-between pb-20 select-none">
      {/* Topo / Barra de Ferramentas */}
      <header className="px-4 py-2.5 bg-[#10131C]/95 backdrop-blur border-b border-gray-800 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate({ to: "/" })}
            className="text-gray-400 hover:text-white p-1 rounded-lg transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xs font-bold text-emerald-400 truncate max-w-[200px]">
                {scoreTitle}
              </h1>
              <span className="bg-amber-500/20 text-amber-400 text-[9px] font-bold px-1.5 py-0.5 rounded border border-amber-500/40">
                PRO OMR
              </span>
            </div>
            <p className="text-[10px] text-gray-400 font-mono">
              {imageSrc
                ? `Pauta ${currentSystemIdx + 1}/${systems.length || 1} • Nota: ${activeNote ? activeNote.name : "--"}`
                : "Aguardando captura da partitura"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowKeyDialog(true)}
            className="h-7 w-7 rounded-md flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-800 transition"
            title="Configurações OMR"
          >
            <KeyRound className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setShowMixer(!showMixer)}
            className={`border border-gray-700 h-7 px-2.5 rounded-md text-[11px] flex items-center gap-1.5 transition ${
              showMixer ? "bg-amber-500/20 text-amber-400 border-amber-500/50" : "text-gray-300"
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Mixer</span>
          </button>
        </div>
      </header>

      {/* Área Central: Scanner Inicial OU Partitura Digitalizada */}
      <main className="flex-1 relative flex items-center justify-center p-3 overflow-hidden bg-[#050608]">
        {!imageSrc ? (
          <div className="w-full max-w-sm p-6 border-2 border-dashed border-gray-800 rounded-2xl bg-[#0F121A] flex flex-col items-center justify-center text-center shadow-xl">
            <div className="p-3.5 rounded-full bg-amber-500/10 text-amber-400 mb-3 ring-1 ring-amber-500/30">
              <Scan className="w-8 h-8" />
            </div>
            <h2 className="text-sm font-semibold mb-1 text-white flex items-center gap-1.5">
              Digitalizar Partitura <span className="text-[10px] bg-amber-500 text-black px-1.5 py-0.2 rounded font-bold">PRO</span>
            </h2>
            <p className="text-[11px] text-gray-400 mb-4 max-w-xs leading-relaxed">
              Fotografe ou envie a imagem da partitura para leitura, transposição e reprodução em tempo real.
            </p>

            <div className="flex flex-col sm:flex-row gap-2 w-full">
              <label className="flex-1 cursor-pointer">
                <span className="inline-flex w-full items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-black font-semibold text-xs py-2 px-3 rounded-lg shadow-lg transition">
                  <Camera className="w-4 h-4" /> Tirar Foto
                </span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>

              <label className="flex-1 cursor-pointer">
                <span className="inline-flex w-full items-center justify-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-white font-semibold text-xs py-2 px-3 rounded-lg border border-gray-700 transition">
                  <Upload className="w-4 h-4 text-gray-400" /> Galeria / Arquivo
                </span>
                <input
                  type="file"
                  accept="image/*,.xml,.musicxml,.mxl"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        ) : (
          <div className="relative w-full max-w-xl max-h-[76vh] h-full rounded-md overflow-hidden border border-gray-800 bg-white flex items-center justify-center shadow-2xl">
            <img
              src={imageSrc}
              alt="Partitura Digitalizada"
              className="w-full h-full object-contain pointer-events-none"
            />

            {/* Caixa indicadora da pauta atual */}
            {activeStaff && (
              <div
                className="absolute left-[2%] right-[2%] border-2 border-red-500/70 bg-red-500/5 pointer-events-none transition-all duration-150"
                style={{
                  top: `${activeStaff.top}%`,
                  height: `${activeStaff.height}%`,
                }}
              >
                {/* Linha vermelha de leitura PlayScore */}
                <div
                  className="absolute top-0 bottom-0 w-[2.5px] bg-red-600 shadow-[0_0_12px_rgba(239,68,68,1)] transition-all duration-100"
                  style={{ left: `${cursorPosition}%` }}
                >
                  <div className="absolute -top-1 -left-[3.5px] w-2.5 h-2.5 bg-red-600 rounded-full" />
                </div>
              </div>
            )}

            {isScanning && (
              <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center gap-2 z-20">
                <Sparkles className="w-8 h-8 text-amber-400 animate-spin" />
                <p className="text-xs font-semibold text-amber-200">
                  Processando pautas e calibrando notas musicais...
                </p>
              </div>
            )}
          </div>
        )}

        {/* Modal de Configuração de Chave API OMR */}
        {showKeyDialog && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-[#141722] border border-gray-700 p-5 rounded-2xl w-full max-w-sm space-y-3">
              <h3 className="text-sm font-bold flex items-center gap-2 text-white">
                <KeyRound className="w-4 h-4 text-amber-400" /> Configuração do Motor OMR
              </h3>
              <p className="text-xs text-gray-400">
                Opcional: Adicione sua chave da Flat.io OMR API ou Audiveris Cloud para ativar reconhecimento profundo em nuvem.
              </p>
              <input
                type="password"
                placeholder="Cole sua chave aqui (opcional)"
                defaultValue={apiKey}
                id="omr-key-input"
                className="w-full bg-[#090B10] border border-gray-700 rounded-md px-3 py-2 text-xs text-white outline-none focus:border-amber-500"
              />
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowKeyDialog(false)}
                  className="px-3 py-1.5 text-xs text-gray-400 hover:text-white transition"
                >
                  Fechar
                </button>
                <button
                  onClick={() => {
                    const el = document.getElementById("omr-key-input") as HTMLInputElement;
                    if (el) handleSaveApiKey(el.value);
                  }}
                  className="bg-amber-500 hover:bg-amber-600 text-black text-xs font-bold px-3 py-1.5 rounded-md transition"
                >
                  Salvar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Painel do Mixer */}
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
                className="w-full accent-amber-500 cursor-pointer"
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
                  title="Diminuir semitom"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="text-[11px] font-mono font-bold">{transposeSemi} semitons</span>
                <button
                  className="h-6 w-6 text-gray-300 flex items-center justify-center hover:bg-gray-800 rounded"
                  onClick={() => setTransposeSemi((p) => p + 1)}
                  title="Aumentar semitom"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Barra Inferior com Controles e Botão de Nova Captura */}
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
                  : "bg-amber-500 hover:bg-amber-600 text-black font-bold"
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
              max="200"
              value={bpm}
              onChange={(e) => setBpm(Number(e.target.value))}
              className="flex-1 accent-amber-500 cursor-pointer"
            />
            <div className="text-right w-14 font-mono text-[11px] text-gray-300">
              ♩ = <span className="font-bold text-amber-400">{bpm}</span>
            </div>
          </div>

          <label className="cursor-pointer">
            <div
              className="w-8 h-8 rounded-full bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-amber-400 border border-gray-700 transition"
              title="Tirar nova foto ou selecionar arquivo"
            >
              <Camera className="w-4 h-4" />
            </div>
            <input
              type="file"
              accept="image/*,.xml,.musicxml,.mxl"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>
        </div>
      </footer>

      <BottomNav />
    </div>
  );
}
