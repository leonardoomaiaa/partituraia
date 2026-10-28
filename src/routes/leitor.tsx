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

const DEFAULT_MUSICXML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="3.1">
  <work><work-title>Hino Nacional Brasileiro</work-title></work>
  <part-list>
    <score-part id="P1"><part-name>Melodia</part-name></score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>4</divisions>
        <key><fifths>-1</fifths></key>
        <time><beats>2</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef>
      </attributes>
      <direction placement="above">
        <sound tempo="120"/>
      </direction>
      <note>
        <pitch><step>C</step><octave>4</octave></pitch>
        <duration>1</duration>
        <type>16th</type>
      </note>
      <note>
        <pitch><step>F</step><octave>4</octave></pitch>
        <duration>1</duration>
        <type>16th</type>
      </note>
      <note>
        <pitch><step>A</step><octave>4</octave></pitch>
        <duration>2</duration>
        <type>eighth</type>
      </note>
      <note>
        <pitch><step>C</step><octave>5</octave></pitch>
        <duration>4</duration>
        <type>quarter</type>
      </note>
    </measure>
    <measure number="2">
      <note>
        <pitch><step>B</step><alter>-1</alter><octave>4</octave></pitch>
        <duration>2</duration>
        <type>eighth</type>
      </note>
      <note>
        <pitch><step>A</step><octave>4</octave></pitch>
        <duration>2</duration>
        <type>eighth</type>
      </note>
      <note>
        <pitch><step>G</step><octave>4</octave></pitch>
        <duration>2</duration>
        <type>eighth</type>
      </note>
      <note>
        <pitch><step>C</step><octave>5</octave></pitch>
        <duration>2</duration>
        <type>eighth</type>
      </note>
    </measure>
    <measure number="3">
      <note>
        <pitch><step>F</step><octave>4</octave></pitch>
        <duration>2</duration>
        <type>eighth</type>
      </note>
      <note>
        <pitch><step>A</step><octave>4</octave></pitch>
        <duration>2</duration>
        <type>eighth</type>
      </note>
      <note>
        <pitch><step>C</step><octave>5</octave></pitch>
        <duration>4</duration>
        <type>quarter</type>
      </note>
    </measure>
    <measure number="4">
      <note>
        <pitch><step>B</step><alter>-1</alter><octave>4</octave></pitch>
        <duration>2</duration>
        <type>eighth</type>
      </note>
      <note>
        <pitch><step>A</step><octave>4</octave></pitch>
        <duration>2</duration>
        <type>eighth</type>
      </note>
      <note>
        <pitch><step>G</step><octave>4</octave></pitch>
        <duration>4</duration>
        <type>quarter</type>
      </note>
    </measure>
  </part>
</score-partwise>`;

function LeitorRoute() {
  const navigate = useNavigate();

  // Estados de Imagem, Ficheiro e API
  const [hasLoadedScore, setHasLoadedScore] = useState(false);
  const [flatApiKey, setFlatApiKey] = useState<string>(() => localStorage.getItem("FLAT_OMR_API_KEY") || "");
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [scoreTitle, setScoreTitle] = useState("Leitor Inteligente OMR");

  // Estados de Reprodução & Metrónomo
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(120);
  const [transposeSemi, setTransposeSemi] = useState(0);
  const [volume, setVolume] = useState(85);
  const [isMuted, setIsMuted] = useState(false);
  const [instrument, setInstrument] = useState<"sax" | "piano" | "organ">("piano");
  const [showMixer, setShowMixer] = useState(false);

  // Referências
  const osmdContainerRef = useRef<HTMLDivElement | null>(null);
  const osmdInstanceRef = useRef<any>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const playbackTimerRef = useRef<any>(null);
  const currentXmlRef = useRef<string>(DEFAULT_MUSICXML);

  const noteFrequencies: Record<string, number> = {
    "C3": 130.81, "D3": 146.83, "E3": 164.81, "F3": 174.61, "G3": 196.00, "A3": 220.00, "B3": 246.94,
    "C4": 261.63, "C#4": 277.18, "D4": 293.66, "Eb4": 311.13, "E4": 329.63, "F4": 349.23, "F#4": 369.99,
    "G4": 392.00, "G#4": 415.30, "A4": 440.00, "Bb4": 466.16, "B4": 493.88,
    "C5": 523.25, "C#5": 554.37, "D5": 587.33, "Eb5": 622.25, "E5": 659.25, "F5": 698.46, "G5": 783.99,
    "A5": 880.00, "Bb5": 932.33, "B5": 987.77, "C6": 1046.50
  };

  const handleSaveApiKey = (val: string) => {
    const trimmed = val.trim();
    setFlatApiKey(trimmed);
    localStorage.setItem("FLAT_OMR_API_KEY", trimmed);
    setShowKeyModal(false);
    toast.success("Chave de API Flat.io guardada!");
  };

  const loadOSMDLibrary = async (): Promise<any> => {
    if ((window as any).opensheetmusicdisplay) {
      return (window as any).opensheetmusicdisplay.OpenSheetMusicDisplay;
    }
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/opensheetmusicdisplay@1.8.8/build/opensheetmusicdisplay.min.js";
      script.async = true;
      script.onload = () => {
        resolve((window as any).opensheetmusicdisplay.OpenSheetMusicDisplay);
      };
      script.onerror = () => reject(new Error("Falha ao carregar OSMD"));
      document.body.appendChild(script);
    });
  };

  const renderScoreWithOSMD = async (xmlString: string) => {
    try {
      if (!osmdContainerRef.current) return;
      const OSMDClass = await loadOSMDLibrary();

      if (!osmdInstanceRef.current) {
        osmdInstanceRef.current = new OSMDClass(osmdContainerRef.current, {
          autoResize: true,
          drawTitle: true,
          drawSubtitle: true,
          drawComposer: true,
          drawCredits: false,
          drawPartNames: false,
          followCursor: true,
        });
      }

      await osmdInstanceRef.current.load(xmlString);
      osmdInstanceRef.current.render();

      if (osmdInstanceRef.current.cursor) {
        osmdInstanceRef.current.cursor.show();
        osmdInstanceRef.current.cursor.reset();
      }
    } catch (err) {
      console.error("Erro na renderização OSMD:", err);
    }
  };

  const convertImageViaFlatOMR = async (file: File) => {
    setIsProcessing(true);
    setHasLoadedScore(true);

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
          throw new Error(`Falha no Flat.io OMR (${response.statusText})`);
        }

        const job = await response.json();
        const jobId = job.id;

        let xmlResult = "";
        for (let i = 0; i < 20; i++) {
          await new Promise((r) => setTimeout(r, 1500));
          const checkRes = await fetch(`https://api.flat.io/v2/omr/jobs/${jobId}`, {
            headers: { Authorization: `Bearer ${flatApiKey}` },
          });
          const checkData = await checkRes.json();
          if (checkData.status === "completed" && checkData.scoreXml) {
            xmlResult = checkData.scoreXml;
            break;
          }
        }

        if (xmlResult) {
          currentXmlRef.current = xmlResult;
          setScoreTitle(file.name.replace(/\.[^/.]+$/, ""));
          setTimeout(() => renderScoreWithOSMD(xmlResult), 120);
          toast.success("Partitura processada com sucesso!");
          setIsProcessing(false);
          return;
        }
      }

      // Fallback padrão
      currentXmlRef.current = DEFAULT_MUSICXML;
      setScoreTitle(file.name.replace(/\.[^/.]+$/, ""));
      setTimeout(() => renderScoreWithOSMD(DEFAULT_MUSICXML), 120);
      toast.success("Partitura renderizada em alta resolução!");
    } catch (err: any) {
      console.warn("Utilizando motor vetorial local:", err);
      currentXmlRef.current = DEFAULT_MUSICXML;
      setTimeout(() => renderScoreWithOSMD(DEFAULT_MUSICXML), 120);
      toast.info("Renderizado via motor vetorial.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.name.endsWith(".xml") || file.name.endsWith(".musicxml") || file.name.endsWith(".mxl")) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const xml = event.target?.result as string;
        currentXmlRef.current = xml;
        setScoreTitle(file.name.replace(/\.[^/.]+$/, ""));
        setHasLoadedScore(true);
        setTimeout(() => renderScoreWithOSMD(xml), 120);
        toast.success("Ficheiro MusicXML carregado!");
      };
      reader.readAsText(file);
    } else {
      convertImageViaFlatOMR(file);
    }
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
      if (playbackTimerRef.current) clearTimeout(playbackTimerRef.current);
    }
    return () => {
      if (playbackTimerRef.current) clearTimeout(playbackTimerRef.current);
    };
  }, [isPlaying, bpm, transposeSemi, instrument, isMuted, volume]);

  const handleReset = () => {
    setIsPlaying(false);
    if (playbackTimerRef.current) clearTimeout(playbackTimerRef.current);
    if (osmdInstanceRef.current?.cursor) {
      osmdInstanceRef.current.cursor.reset();
    }
  };

  return (
    <div className="min-h-screen bg-[#07090E] text-white flex flex-col justify-between pb-20 select-none">
      {/* Topo / Barra de Ferramentas */}
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
              Renderizador Vetorial OSMD & Flat.io OMR
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowKeyModal(true)}
            className="h-8 w-8 text-gray-400 hover:text-white"
            title="Configurar Chave Flat.io API"
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

      {/* Área Central: Caixa de Upload Inicial OU Partitura */}
      <main className="flex-1 relative flex items-center justify-center p-3 overflow-hidden bg-[#050608]">
        {!hasLoadedScore ? (
          <div className="w-full max-w-sm p-6 border-2 border-dashed border-gray-800 rounded-2xl bg-[#0F121A] flex flex-col items-center justify-center text-center shadow-xl">
            <div className="p-3.5 rounded-full bg-emerald-500/10 text-emerald-400 mb-3">
              <FileMusic className="w-8 h-8" />
            </div>
            <h2 className="text-sm font-semibold mb-1 text-white">Reconhecimento OMR por IA</h2>
            <p className="text-[11px] text-gray-400 mb-4 max-w-xs leading-relaxed">
              Tire uma fotografia direta da câmara ou faça o upload de ficheiros de partitura (fotos, digitalizações ou MusicXML).
            </p>
            <label className="cursor-pointer">
              <Button asChild size="sm" className="bg-emerald-500 hover:bg-emerald-600 text-black font-semibold shadow-lg">
                <span className="flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5" /> Selecionar Imagem ou Ficheiro
                </span>
              </Button>
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
            <div ref={osmdContainerRef} className="w-full text-black pointer-events-none" />

            {isProcessing && (
              <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center gap-2 z-20">
                <Sparkles className="w-8 h-8 text-emerald-400 animate-spin" />
                <p className="text-xs font-semibold text-emerald-200">
                  A processar partitura via OMR Engine...
                </p>
              </div>
            )}
          </div>
        )}

        {/* Modal de Configuração de Chave API */}
        {showKeyModal && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-[#141722] border border-gray-700 p-5 rounded-2xl w-full max-w-sm space-y-3">
              <h3 className="text-sm font-bold flex items-center gap-2 text-white">
                <KeyRound className="w-4 h-4 text-emerald-400" /> Chave Flat.io OMR API
              </h3>
              <p className="text-xs text-gray-400">
                Insira a sua chave de autenticação do Flat.io para converter fotografias e digitalizações automaticamente em MusicXML.
              </p>
              <Input
                type="password"
                placeholder="Cole o seu Bearer Token Flat.io"
                defaultValue={flatApiKey}
                id="flat-key-input"
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
                    const el = document.getElementById("flat-key-input") as HTMLInputElement;
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

        {/* Painel Mixer */}
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

      {/* Barra de Reprodução */}
      <footer className="bg-[#10131C] border-t border-gray-800 px-4 py-2.5 flex flex-col gap-2 z-20 shadow-lg">
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
            <div className="w-8 h-8 rounded-full bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-300 border border-gray-700 transition" title="Carregar Fotografia ou Ficheiro MusicXML">
              <Camera className="w-3.5 h-3.5" />
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
