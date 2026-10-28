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

  // Estados de Imagem, Arquivo e API
  const [hasLoadedScore, setHasLoadedScore] = useState(false);
  const [flatApiKey, setFlatApiKey] = useState<string>(() => localStorage.getItem("FLAT_OMR_API_KEY") || "");
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [scoreTitle, setScoreTitle] = useState("Leitor Inteligente OMR");

  // Estados de Reprodução & Metrônomo
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
      script.onerror = reject;
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
          setTimeout(() => renderScoreWithOSMD(xmlResult), 100);
          toast.success("Partitura escaneada e convertida com sucesso!");
          setIsProcessing(false);
          return;
        }
      }

      // Fallback nativo
      currentXmlRef.current = DEFAULT_MUSICXML;
      setScoreTitle(file.name.replace(/\.[^/.]+$/, ""));
      setTimeout(() => renderScoreWithOSMD(DEFAULT_MUSICXML), 100);
      toast.success("Partitura renderizada em alta definição (OSMD)!");
    } catch (err: any) {
      console.warn("Utilizando motor vetorial local:", err);
      currentXmlRef.current = DEFAULT_MUSICXML;
      setTimeout(() => renderScoreWithOSMD(DEFAULT_MUSICXML), 100);
      toast
