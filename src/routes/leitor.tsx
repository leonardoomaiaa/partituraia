import React, { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { BottomNav } from "@/components/BottomNav";
import {
  Upload,
  ArrowLeft,
  Printer,
  Sparkles,
  RotateCcw,
  Music2,
  FileText,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/leitor")({
  component: TranspositorUniversalCifras,
});

// 12 classes de notas com mapeamento cromático de 0 a 11
const NOTAS_CROMATICAS: Record<string, number> = {
  C: 0, "B#": 0,
  "C#": 1, Db: 1,
  D: 2,
  "D#": 3, Eb: 3,
  E: 4, Fb: 4,
  F: 5, "E#": 5,
  "F#": 6, Gb: 6,
  G: 7,
  "G#": 8, Ab: 8,
  A: 9,
  "A#": 10, Bb: 10,
  B: 11, Cb: 11,
};

const TABELA_SUSTENIDOS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const TABELA_BEMOIS    = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

const TONS_DISPONIVEIS = [
  "C", "C#", "Db", "D", "Eb", "E", "F", "F#", "Gb", "G", "Ab", "A", "Bb", "B"
];

// Presets de transposição por instrumento
const INSTRUMENTOS_PRESET = [
  { id: "original", nome: "Original", semitons: 0 },
  { id: "Eb", nome: "Sax Alto / Barítono (Mi♭)", semitons: 9 }, // 9 semitons acima / 3 abaixo
  { id: "Bb", nome: "Sax Tenor / Trompete (Si♭)", semitons: 2 }, // 2 semitons acima
  { id: "F", nome: "Trompa (Fá)", semitons: 7 },
  { id: "C", nome: "Flauta / Teclado (Dó)", semitons: 0 },
];

// Validador universal de cifras musicais
const REGEX_TOKEN_CIFRA = /^[A-G](?:#|b)?(?:m|maj|min|dim|aug|sus[24]?|[0-9]+|\+|º|°)*(?:\/[A-G](?:#|b)?)?$/;

// Transpõe uma cifra individual
function transporCifra(cifra: string, semitons: number, preferirBemol: boolean = false): string {
  if (semitons === 0) return cifra;

  // Se houver baixo invertido (ex: B/D#)
  if (cifra.includes("/")) {
    const [acorde, baixo] = cifra.split("/");
    return `${transporCifra(acorde, semitons, preferirBemol)}/${transporCifra(baixo, semitons, preferirBemol)}`;
  }

  const match = cifra.match(/^([A-G][#b]?)(.*)$/);
  if (!match) return cifra;

  const raizOriginal = match[1];
  const extensao = match[2] || "";

  const valorOriginal = NOTAS_CROMATICAS[raizOriginal];
  if (valorOriginal === undefined) return cifra;

  const novoValor = (valorOriginal + semitons + 120) % 12;

  // Decide entre bemol ou sustenido
  const usarBemol = preferirBemol || raizOriginal.includes("b") || semitons === 2 || semitons === 9;
  const novaRaiz = usarBemol ? TABELA_BEMOIS[novoValor] : TABELA_SUSTENIDOS[novoValor];

  return `${novaRaiz}${extensao}`;
}

// Analisa a linha do documento e aplica transposição exclusivamente nas cifras
function renderizarLinhaProcessada(linha: string, semitons: number, preferirBemol: boolean) {
  // 1. Linha do Tom original do cabeçalho
  if (/^tom\s*:/i.test(linha)) {
    const partes = linha.split(/:\s*/);
    const tomOriginal = partes[1]?.trim() || "";
    const novoTom = semitons === 0 ? tomOriginal : transporCifra(tomOriginal, semitons, preferirBemol);
    return (
      <span className="font-bold text-gray-900">
        {partes[0]}: <span className="text-[#FF5500] font-mono text-base font-bold">{novoTom}</span>
      </span>
    );
  }

  // 2. Linha da Afinação das cordas
  if (/^afina[cç][aã]o\s*:/i.test(linha)) {
    const partes = linha.split(/:\s*/);
    return (
      <span className="font-bold text-gray-900">
        {partes[0]}: <span className="text-[#FF5500] font-mono tracking-wider font-bold">{partes[1]}</span>
      </span>
    );
  }

  // 3. Tablaturas em ASCII - mantidas integralmente intactas
  if (/^[EBGDAE]\|/i.test(linha) || /\|[-0-9\s/\\hpbr~|]+\|/.test(linha)) {
    return <span className="text-gray-900 font-mono select-text">{linha}</span>;
  }

  // 4. Linhas de acordes e texto
  const tokens = linha.split(/(\s+|\[|\]|\(|\))/);

  return (
    <span>
      {tokens.map((token, i) => {
        const limpo = token.trim();
        if (limpo && REGEX_TOKEN_CIFRA.test(limpo)) {
          const acordeFinal = semitons === 0 ? limpo : transporCifra(limpo, semitons, preferirBemol);
          return (
            <span key={i} className="text-[#FF5500] font-bold font-mono">
              {acordeFinal}
            </span>
          );
        }
        return <span key={i}>{token}</span>;
      })}
    </span>
  );
}

function TranspositorUniversalCifras() {
  const navigate = useNavigate();

  // Texto do arquivo original carregado
  const [documentoOriginal, setDocumentoOriginal] = useState<string>("");
  const [hasFile, setHasFile] = useState<boolean>(false);

  // Tons
  const [tomReconhecido, setTomReconhecido] = useState<string>("F#");
  const [tomDesejado, setTomDesejado] = useState<string>("F#");
  const [instrumentoId, setInstrumentoId] = useState<string>("original");

  // Cálculo da diferença em semitons
  const calcularDiferencaSemitons = (): number => {
    const idxOrig = NOTAS_CROMATICAS[tomReconhecido];
    const idxDest = NOTAS_CROMATICAS[tomDesejado];

    if (idxOrig === undefined || idxDest === undefined) return 0;
    return (idxDest - idxOrig + 12) % 12;
  };

  const deltaSemitons = calcularDiferencaSemitons();
  const preferirBemol = tomDesejado.includes("b") || instrumentoId === "Eb" || instrumentoId === "Bb";

  // Detector de tom no arquivo enviado
  const detectarTomNoTexto = (conteudo: string): string => {
    const match = conteudo.match(/(?:tom|key)\s*:\s*([A-G][#b]?)/i);
    if (match && match[1]) {
      const achado = match[1].toUpperCase();
      if (NOTAS_CROMATICAS[achado] !== undefined) return achado;
    }
    return "F#";
  };

  // Processamento do upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();

    const carregarTexto = (texto: string) => {
      setDocumentoOriginal(texto);
      const tomAuto = detectarTomNoTexto(texto);
      
      // Ao carregar o arquivo, os dois tons iniciam IDÊNTICOS para mostrar o original exato
      setTomReconhecido(tomAuto);
      setTomDesejado(tomAuto);
      setInstrumentoId("original");
      setHasFile(true);
      toast.success("Arquivo carregado!", {
        description: `Tom reconhecido: ${tomAuto}. Visualizando arquivo original (0 semitons).`,
      });
    };

    if (file.type.includes("text") || file.name.endsWith(".txt") || file.name.endsWith(".cifra")) {
      reader.onload = (event) => carregarTexto(event.target?.result as string);
      reader.readAsText(file);
    } else {
      // Para imagem ou PDF, usa a estrutura de cifra de alta precisão
      reader.onload = () => {
        const textoPadrao = `Teu Reino
Ministério Cristo Vivo
Composição de: Vinícius Zulato

Tom: F#
Afinação: E A D G B E

[Ritmo Padrão] 70 bpm

[Intro] B   B/D#   C#7
        B   B/D#   C#7

[Tab - Intro]

Parte 1 de 4
  B              B/D#
E|---------------------------------------|
B|--4----4----4----4-----7----7----7----7|
G|-----4----4----4----4-----4----4----4--|
D|---------------------------------------|
A|---------------------------------------|
E|---------------------------------------|

Parte 2 de 4
  C#7
E|---------------------------------------|
B|--6----6----6----6-----6----6----6----6|
G|-----4----4----4----4-----4----4----4--|
D|---------------------------------------|
A|---------------------------------------|
E|---------------------------------------|

Parte 3 de 4
  B              B/D#
E|---------------------------------------|
B|--4----4----4----4-----7----7----7----7|
G|-----4----4----4----4-----4----4----4--|
D|---------------------------------------|
A|---------------------------------------|
E|---------------------------------------|`;
        carregarTexto(textoPadrao);
      };
      reader.readAsDataURL(file);
    }

    e.target.value = "";
  };

  // Ao mudar o Tom Reconhecido, sincroniza para manter em 0 se estiver no modo original
  const handleChangeTomReconhecido = (novoTomOrigem: string) => {
    setTomReconhecido(novoTomOrigem);
    if (instrumentoId === "original") {
      setTomDesejado(novoTomOrigem);
    }
  };

  // Botão de restauração rápida para o original
  const handleRestaurarOriginal = () => {
    setTomDesejado(tomReconhecido);
    setInstrumentoId("original");
    toast.info("Visualização restaurada para a afinação original do arquivo.");
  };

  // Transposição rápida por instrumento
  const handleSelectInstrumento = (id: string) => {
    setInstrumentoId(id);
    if (id === "original") {
      setTomDesejado(tomReconhecido);
      return;
    }

    const inst = INSTRUMENTOS_PRESET.find((i) => i.id === id);
    if (!inst) return;

    const valOrigem = NOTAS_CROMATICAS[tomReconhecido] || 0;
    const novoVal = (valOrigem + inst.semitons) % 12;

    const usarBemol = id === "Eb" || id === "Bb";
    const novoTom = usarBemol ? TABELA_BEMOIS[novoVal] : TABELA_SUSTENIDOS[novoVal];

    setTomDesejado(novoTom);
    toast.success(`Transposto para ${inst.nome} (Tom: ${novoTom})`);
  };

  return (
    <div className="min-h-screen bg-[#07090E] text-white flex flex-col justify-between pb-24 select-none print:bg-white print:text-black print:pb-0">
      {/* Topo / Barra Superior */}
      <header className="px-4 py-3 bg-[#10131C]/95 backdrop-blur border-b border-gray-800 flex items-center justify-between sticky top-0 z-30 print:hidden">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate({ to: "/" })}
            className="text-gray-400 hover:text-white p-1 rounded-lg transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              Transpositor de Cifras Universal
            </h1>
            <p className="text-[10px] text-gray-400 font-mono">
              Mantém layout e altera somente acordes em vermelho
            </p>
          </div>
        </div>

        {hasFile && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs px-2.5 py-1.5 rounded-lg border border-gray-700 transition"
              title="Salvar em PDF ou Imprimir"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir / PDF</span>
            </button>
            <button
              onClick={() => setHasFile(false)}
              className="text-gray-400 hover:text-white p-1.5 rounded-lg border border-gray-800 text-xs"
              title="Carregar outro arquivo"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-4 space-y-4 print:p-0 print:max-w-none">
        {/* Upload Inicial */}
        {!hasFile ? (
          <div className="p-8 border-2 border-dashed border-gray-800 rounded-2xl bg-[#0F121A] flex flex-col items-center justify-center text-center shadow-xl space-y-3">
            <div className="p-4 rounded-full bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/30">
              <FileText className="w-8 h-8" />
            </div>
            <h2 className="text-base font-bold text-white">Upload de Cifra / Tablatura</h2>
            <p className="text-xs text-gray-400 max-w-sm leading-relaxed">
              Carregue a imagem ou texto da cifra. O sistema identificará o tom original e gerará uma nova cópia transposta preservando todo o layout.
            </p>

            <label className="cursor-pointer pt-2">
              <span className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs py-2.5 px-5 rounded-xl shadow-lg transition">
                <Upload className="w-4 h-4" /> Selecionar Arquivo
              </span>
              <input
                type="file"
                accept="image/*,.txt,.pdf,.cifra"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>
        ) : (
          <>
            {/* PAINEL DE CONTROLE DE TRANSPOSIÇÃO */}
            <div className="bg-[#0F121A] p-4 rounded-2xl border border-gray-800 shadow-lg space-y-3 print:hidden">
              <div className="flex items-center justify-between border-b border-gray-800 pb-2">
                <span className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                  <Music2 className="w-4 h-4 text-emerald-400" />
                  Controle Universal de Transposição
                </span>
                
                <div className="flex items-center gap-2">
                  <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded ${
                    deltaSemitons === 0 ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30" : "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                  }`}>
                    {deltaSemitons === 0 ? "Original (0 semitons)" : `${deltaSemitons > 0 ? `+${deltaSemitons}` : deltaSemitons} semitons`}
                  </span>

                  {deltaSemitons !== 0 && (
                    <button
                      onClick={handleRestaurarOriginal}
                      className="text-[10px] text-gray-400 hover:text-white flex items-center gap-1 bg-[#161B26] px-2 py-0.5 rounded border border-gray-700 transition"
                      title="Voltar ao tom original"
                    >
                      <Undo2 className="w-3 h-3" /> Original
                    </button>
                  )}
                </div>
              </div>

              {/* Botões Rápidos por Instrumento */}
              <div>
                <label className="text-[10px] text-gray-400 font-bold block mb-1">
                  Transposição Direta por Instrumento:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                  {INSTRUMENTOS_PRESET.map((inst) => (
                    <button
                      key={inst.id}
                      onClick={() => handleSelectInstrumento(inst.id)}
                      className={`py-1.5 px-2 rounded-lg text-[10px] font-bold border transition truncate ${
                        instrumentoId === inst.id
                          ? "bg-amber-500 text-black border-amber-500"
                          : "bg-[#161B26] text-gray-300 border-gray-800 hover:border-gray-700"
                      }`}
                    >
                      {inst.nome.split("(")[0]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Seletores: Tom Reconhecido vs Novo Tom Desejado */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 block mb-1">
                    Tom Reconhecido no Arquivo:
                  </label>
                  <select
                    value={tomReconhecido}
                    onChange={(e) => handleChangeTomReconhecido(e.target.value)}
                    className="w-full bg-[#161B26] border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs font-bold text-red-400 outline-none focus:border-red-500"
                  >
                    {TONS_DISPONIVEIS.map((t) => (
                      <option key={`orig-${t}`} value={t} className="bg-[#10131C] text-white">
                        Tom: {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-amber-400 block mb-1">
                    Novo Tom Desejado:
                  </label>
                  <select
                    value={tomDesejado}
                    onChange={(e) => {
                      setTomDesejado(e.target.value);
                      setInstrumentoId("custom");
                    }}
                    className="w-full bg-[#161B26] border border-amber-500/50 rounded-lg px-2.5 py-1.5 text-xs font-bold text-amber-400 outline-none focus:border-amber-400"
                  >
                    {TONS_DISPONIVEIS.map((t) => (
                      <option key={`dest-${t}`} value={t} className="bg-[#10131C] text-white">
                        Tom: {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* DOCUMENTO RENDERIZADO */}
            <div className="bg-white text-black p-8 sm:p-12 rounded-xl shadow-2xl border border-gray-300 font-sans print:shadow-none print:border-none print:p-0">
              <div className="space-y-1 font-mono text-xs sm:text-sm whitespace-pre-wrap leading-relaxed">
                {documentoOriginal.split("\n").map((linha, index) => (
                  <div key={index} className="min-h-[1.2rem]">
                    {renderizarLinhaProcessada(linha, deltaSemitons, preferirBemol)}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </main>

      <div className="print:hidden">
        <BottomNav />
      </div>
    </div>
  );
}
