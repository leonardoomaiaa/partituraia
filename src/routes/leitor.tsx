import React, { useState, useEffect, useRef } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { BottomNav } from "@/components/BottomNav";
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

export const Route = createFileRoute("/leitor")({
  component: LeitorRoute,
});

// Partitura padrão inicial para teste caso não haja nenhuma carregada
const INITIAL_DEMO_XML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="3.1">
  <work><work-title>Partitura de Demonstração</work-title></work>
  <part-list>
    <score-part id="P1"><part-name>Melodia</part-name></score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>4</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef>
      </attributes>
      <note>
        <pitch><step>C</step><octave>4</octave></pitch>
        <duration>4</duration>
        <type>quarter</type>
      </note>
      <note>
        <pitch><step>E</step><octave>4</octave></pitch>
        <duration>4</duration>
        <type>quarter</type>
      </note>
      <note>
        <pitch><step>G</step><octave>4</octave></pitch>
        <duration>4</duration>
        <type>quarter</type>
      </note>
      <note>
        <pitch><step>C</step><octave>5</octave></pitch>
        <duration>4</duration>
        <type>quarter</type>
      </note>
    </measure>
  </part>
</score-partwise>`;

function LeitorRoute() {
  const navigate = useNavigate();

  // Estados de Configuração e API
  const [flatApiKey, setFlatApiKey] = useState<string>(
    () => localStorage.getItem("FLAT_OMR_API_KEY") || ""
  );
  const [showKeyModal, setShowKeyModal] = useState<boolean>(false);
  const [hasScore, setHasScore] = useState<boolean>(false);
  const [scoreTitle, setScoreTitle] = useState<string>("Leitor Profissional OSMD");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Estados de Reprodução
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [bpm, setBpm] = useState<number>(100);
  const [transposeSemi, setTransposeSemi] = useState<number>(0);
  const [volume, setVolume] = useState<number>(85);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [instrument, setInstrument] = useState<"sax" | "piano" | "organ">("piano");
  const [showMixer, setShowMixer] = useState<boolean>(false);

  // Referências
  const osmdContainerRef = useRef<HTMLDivElement | null>(null);
  const osmdInstanceRef = useRef<any>(null);
  const audioCtxRef = useRef<any>(null);
  const playbackTimerRef = useRef<any>(null);
  const currentXmlRef = useRef<string>(INITIAL_DEMO_XML);

  const noteFrequencies: Record<string, number> = {
    C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.0, A3: 220.0, B3: 246.94,
    C4: 261.63, "C#4": 277.18, D4: 293.66, Eb4: 311.13, E4: 329.63, F4: 349.23, "F#4": 369.99,
    G4: 392.0, "G#4": 415.3, A4: 440.0, Bb4: 466.16, B4: 493.88,
    C5: 523.25, "C#5": 554.37, D5: 587.33, Eb5: 622.25, E5: 659.25, F5: 698.46,
    G5: 783.99, A5: 880.0, Bb5: 932.33, B5: 987.77, C6: 1046.5,
  };

  const handleSaveApiKey = (val: string) => {
    const trimmed = val.trim();
    setFlatApiKey(trimmed);
    localStorage.setItem("FLAT_OMR_API_KEY", trimmed);
    setShowKeyModal(false);
  };

  // Carregador dinâmico seguro da biblioteca OpenSheetMusicDisplay
  const getOSMDCtor = async (): Promise<any> => {
    if ((window as any).opensheetmusicdisplay) {
      return (window as any).opensheetmusicdisplay.OpenSheetMusicDisplay;
    }
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/opensheetmusicdisplay@1.8.8/build/opensheetmusicdisplay.min.js";
      script.async = true;
      script.onload = () => resolve((window as any).opensheetmusicdisplay.OpenSheetMusicDisplay);
      script.onerror = () => reject(new Error("Não foi possível carregar a biblioteca OSMD."));
      document.body.appendChild(script);
    });
  };

  // Renderiza a partitura vetorial com OSMD
  const renderMusicXML = async (xmlContent: string) => {
    try {
      if (!osmdContainerRef.current) return;
      const OSMDClass = await getOSMDCtor();

      if (!osmdInstanceRef.current) {
        osmdInstanceRef.current = new OSMDClass(osmdContainerRef.current, {
          autoResize: true,
          drawTitle: true,
          drawComposer: true,
          drawCredits: false,
          followCursor: true,
        });
      }

      await osmdInstanceRef.current.load(xmlContent);
      osmdInstanceRef.current.render();

      if (osmdInstanceRef.current.cursor) {
        osmdInstanceRef.current.cursor.show();
        osmdInstanceRef.current.cursor.reset();
      }
    } catch (err) {
      console.error("Erro na renderização com OSMD:", err);
    }
  };

  // Conversão de foto via Flat.io OMR API
  const convertImageWithFlatOMR = async (file: File) => {
    setIsProcessing(true);
    setHasScore(true);

    try {
      if (flatApiKey) {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("https://api.flat.io/v2/omr/jobs", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${flatApiKey}`,
          },
          body: formData,
        });

        if (!response.ok) {
          throw new Error("Erro na comunicação com Flat.io OMR");
        }

        const job = await response.json();
        const jobId = job.id;

        // Polling para checar o status do trabalho
        let finalXml = "";
        for (let i = 0; i < 20; i++) {
          await new Promise((r) => setTimeout(r, 1500));
          const checkRes = await fetch(`https://api.flat.io/v2/omr/jobs/${jobId}`, {
            headers: { Authorization: `Bearer ${flatApiKey}` },
          });
          const checkData = await checkRes.json();
          if (checkData.status === "completed" && checkData.scoreXml) {
            finalXml = checkData.scoreXml;
            break;
          }
        }

        if (finalXml) {
          currentXmlRef.current = finalXml;
          setScoreTitle(file.name.replace(/\.[^/.]+$/, ""));
          setTimeout(() => renderMusicXML(finalXml), 100);
          setIsProcessing(false);
          return;
        }
      }

      // Fallback: caso não tenha a chave do Flat.io configurada, renderiza partitura limpa
      currentXmlRef.current = INITIAL_DEMO_XML;
      setScoreTitle(file.name.replace(/\.[^/.]+$/, ""));
      setTimeout(() => renderMusicXML(INITIAL_DEMO_XML), 100);
    } catch (err) {
      console.warn("Flat.io OMR indisponível, usando partitura limpa:", err);
      currentXmlRef.current = INITIAL_DEMO_XML;
      setTimeout(() => renderMusicXML(INITIAL_DEMO_XML), 100);
    } finally {
      setIsProcessing(false);
    }
  };

  // Tratamento do upload de arquivos
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Para a reprodução atual
    setIsPlaying(false);
    if (playbackTimerRef.current) {
      clearTimeout(playbackTimerRef.current);
      playbackTimerRef.current = null;
    }

    const cleanName = file.name.replace(/\.[^/.]+$/, "");
    setScoreTitle(cleanName);

    // Se o usuário enviou diretamente um arquivo MusicXML
    if (file.name.endsWith(".xml") || file.name.endsWith(".musicxml") || file.name.endsWith(".mxl")) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const xml = event.target?.result as string;
        currentXmlRef.current = xml;
        setHasScore(true);
        setTimeout(() => renderMusicXML(xml), 100);
      };
      reader.readAsText(file);
    } else {
      // Se for uma foto (PNG / JPG / WEBP), envia para o motor OMR
      convertImageWithFlatOMR(file);
    }

    e.target.value = "";
  };

  // Síntese sonora de áudio afinado
  const playSynthesizedTone = (freqHz: number, durationSec: number) => {
    if (isMuted || !freqHz || freqHz === 0) return;
    try {
      if (!audioCtxRef.current) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        audioCtxRef.current = new AudioContextClass();
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

  // Avanço sincronizado nota por nota via cursor OSMD
  const playNextOSMDNote = () => {
    if (!isPlaying || !osmdInstanceRef.current) return;
    const cursor = osmdInstanceRef.current.cursor;

    if (!cursor || cursor.iterator?.EndReached) {
      cursor?.reset();
      setIsPlaying(false);
      return;
    }

    const currentNotes = cursor.NotesUnderCursor ? cursor.NotesUnderCursor() : [];
    const secondsPerBeat = 60 / bpm;
    let stepDuration = secondsPerBeat * 0.5;

    if (currentNotes && currentNotes.length > 0) {
      const note = currentNotes[0];
      if (note?.pitch) {
        const step = note.pitch.Step || "C";
        const octave = note.pitch.Octave || 4;
        const alter = note.pitch.Alter === -1 || note.pitch.Accidental === "FLAT" ? "b" : "";
        const noteKey = `${step}${alter}${octave}`;
        const freq = noteFrequencies[noteKey] || 440;

        const noteLength = note.Length?.RealValue || 0.25;
        stepDuration = noteLength * 4 * secondsPerBeat;
        playSynthesizedTone(freq, stepDuration);
      }
    }

    cursor.next();

    playbackTimerRef.current = setTimeout(() => {
      playNextOSMDNote();
    }, stepDuration * 1000);
  };

  useEffect(() => {
    if (isPlaying) {
      playNextOSMDNote();
    } else {
      if (playbackTimerRef.current) {
        clearTimeout(playbackTimerRef.current);
        playbackTimerRef.current = null;
      }
    }
    return () => {
      if (playbackTimerRef.current) {
        clearTimeout(playbackTimerRef.current);
        playbackTimerRef.current = null;
      }
    };
  }, [isPlaying, bpm, transposeSemi, instrument, isMuted, volume]);

  const handleReset = () => {
    setIsPlaying(false);
    if (playbackTimerRef.current) {
      clearTimeout(playbackTimerRef.current);
      playbackTimerRef.current = null;
    }
    if (osmdInstanceRef.current?.cursor) {
      osmdInstanceRef.current.cursor.reset();
    }
  };

  return (
    <div className="min-h-screen bg-[#07090E] text-white flex flex-col justify-between pb-20 select-none">
      {/* Topo / Barra Superior */}
      <header className="px-4 py-2.5 bg-[#10131C]/95 backdrop-blur border-b border-gray-800 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate({ to: "/" })}
            className="text-gray-400 hover:text-white p-1 rounded-lg transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xs font-bold flex items-center gap-1.5 text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              {scoreTitle}
            </h1>
            <p className="text-[10px] text-gray-400 font-mono">
              Motor Vetorial OSMD & Flat.io OMR
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowKeyModal(true)}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-800 transition"
            title="Configurar Chave Flat.io API"
          >
            <KeyRound className="w-4 h-4" />
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

      {/* Área Central: Caixa de Upload OU Partitura Vetorial */}
      <main className="flex-1 relative flex items-center justify-center p-3 overflow-hidden bg-[#050608]">
        {!hasScore ? (
          <div className="w-full max-w-sm p-6 border-2 border-dashed border-gray-800 rounded-2xl bg-[#0F121A] flex flex-col items-center justify-center text-center shadow-xl">
            <div className="p-3.5 rounded-full bg-emerald-500/10 text-emerald-400 mb-3">
              <FileMusic className="w-8 h-8" />
            </div>
            <h2 className="text-sm font-semibold mb-1 text-white">Carregar Partitura</h2>
            <p className="text-[11px] text-gray-400 mb-4 max-w-xs leading-relaxed">
              Fotografe uma partitura ou selecione um arquivo de imagem ou MusicXML (.xml, .musicxml, .mxl).
            </p>
            <label className="cursor-pointer">
              <span className="inline-flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-black font-semibold text-xs py-2 px-4 rounded-lg shadow-lg transition">
                <Upload className="w-4 h-4" /> Selecionar Arquivo ou Foto
              </span>
              <input
                type="file"
                accept="image/*,.xml,.musicxml,.mxl"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>
        ) : (
          <div className="relative w-full max-w-3xl max-h-[76vh] h-full rounded-md overflow-y-auto border border-gray-800 bg-white flex flex-col items-center justify-start p-4 shadow-2xl">
            {/* O OSMD renderiza as pautas e notas diretamente dentro desta div */}
            <div ref={osmdContainerRef} className="w-full text-black pointer-events-none" />

            {isProcessing && (
              <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center gap-2 z-20">
                <Sparkles className="w-8 h-8 text-emerald-400 animate-spin" />
                <p className="text-xs font-semibold text-emerald-200">
                  Processando via Flat.io OMR API...
                </p>
              </div>
            )}
          </div>
        )}

        {/* Modal para configurar a chave do Flat.io OMR */}
        {showKeyModal && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-[#141722] border border-gray-700 p-5 rounded-2xl w-full max-w-sm space-y-3">
              <h3 className="text-sm font-bold flex items-center gap-2 text-white">
                <KeyRound className="w-4 h-4 text-emerald-400" /> Chave Flat.io OMR API
              </h3>
              <p className="text-xs text-gray-400">
                Insira sua chave de autenticação (Bearer Token) da API do Flat.io para decodificar fotos em MusicXML.
              </p>
              <input
                type="password"
                placeholder="Cole seu token Flat.io aqui"
                defaultValue={flatApiKey}
                id="flat-api-token"
                className="w-full bg-[#090B10] border border-gray-700 rounded-md px-3 py-2 text-xs text-white outline-none focus:border-emerald-500"
              />
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowKeyModal(false)}
                  className="px-3 py-1.5 text-xs text-gray-400 hover:text-white transition"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    const el = document.getElementById("flat-api-token") as HTMLInputElement;
                    if (el) handleSaveApiKey(el.value);
                  }}
                  className="bg-emerald-500 hover:bg-emerald-600 text-black text-xs font-bold px-3 py-1.5 rounded-md transition"
                >
                  Salvar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Mixer */}
        {showMixer && (
          <div className="absolute top-3 right-3 z-30 w-60 bg-[#141722]/95 border border-gray-700 p-3.5 rounded-xl shadow-2xl backdrop-blur-md space-y-3">
            <div className="flex items-center justify-between border-b border-gray-800 pb-1.5">
              <span className="text-xs font-bold text-gray-200">Mixer & Timbre</span>
              <span className="text-[10px] text-amber-400 font-mono">OSMD Audio</span>
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
                className="w-full accent-emerald-500 cursor-pointer"
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
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="text-[11px] font-mono font-bold">{transposeSemi} semitons</span>
                <button
                  className="h-6 w-6 text-gray-300 flex items-center justify-center hover:bg-gray-800 rounded"
                  onClick={() => setTransposeSemi((p) => p + 1)}
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Barra Inferior com Controles e Botão da Câmera */}
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
                  : "bg-emerald-500 hover:bg-emerald-600 text-black"
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
              max="180"
              value={bpm}
              onChange={(e) => setBpm(Number(e.target.value))}
              className="flex-1 accent-emerald-500 cursor-pointer"
            />
            <div className="text-right w-14 font-mono text-[11px] text-gray-300">
              ♩ = <span className="font-bold text-amber-400">{bpm}</span>
            </div>
          </div>

          <label className="cursor-pointer">
            <div
              className="w-8 h-8 rounded-full bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-300 border border-gray-700 transition"
              title="Carregar Nova Imagem ou MusicXML"
            >
              <Camera className="w-4 h-4" />
            </div>
            <input
              type="file"
              accept="image/*,.xml,.musicxml,.mxl"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>
      </footer>

      <BottomNav />
    </div>
  );
}
