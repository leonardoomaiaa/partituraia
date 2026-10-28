import React, { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { BottomNav } from "@/components/BottomNav";
import {
  Upload,
  Camera,
  ArrowLeft,
  Printer,
  Sparkles,
  RotateCcw,
  Music2,
  FileText,
  Layers,
  Edit3,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/leitor")({
  component: TranspositorDinamicoReal,
});

// Tabela cromática de 12 semitons
const NOTAS_SEMITONS: Record<string, number> = {
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

const INSTRUMENTOS_PRESET = [
  { id: "original", nome: "Original", semitons: 0 },
  { id: "Eb", nome: "Sax Alto / Barítono (Mi♭)", semitons: 9 },
  { id: "Bb", nome: "Sax Tenor / Trompete (Si♭)", semitons: 2 },
  { id: "F", nome: "Trompa (Fá)", semitons: 7 },
  { id: "C", nome: "Flauta / Teclado (Dó)", semitons: 0 },
];

// GRUPO 1: Identifica estritamente notas e cifras musicais reais
const REGEX_GRUPO1_CIFRA = /^[A-G][#b]?(?:m|min|maj|M|dim|aug|sus[24]?|[0-9]+|\+|º|°)*(?:\/[A-G][#b]?)?$/;

// Transpõe o Grupo 1 mantendo acidentes e baixos invertidos
function transporGrupo1(cifra: string, semitons: number, preferirBemol: boolean): string {
  if (semitons === 0) return cifra;

  if (cifra.includes("/")) {
    const [acorde, baixo] = cifra.split("/");
    return `${transporGrupo1(acorde, semitons, preferirBemol)}/${transporGrupo1(baixo, semitons, preferirBemol)}`;
  }

  const match = cifra.match(/^([A-G][#b]?)(.*)$/);
  if (!match) return cifra;

  const raiz = match[1];
  const sufixo = match[2] || "";

  const valor = NOTAS_SEMITONS[raiz];
  if (valor === undefined) return cifra;

  const novoValor = (valor + semitons + 120) % 12;
  const usarBemol = preferirBemol || raiz.includes("b") || semitons === 2 || semitons === 9;
  const novaRaiz = usarBemol ? TABELA_BEMOIS[novoValor] : TABELA_SUSTENIDOS[novoValor];

  return `${novaRaiz}${sufixo}`;
}

// Processador de Linha baseado na separação de Grupos para QUALQUER ficheiro
function renderizarLinhaPorGrupos(
  linha: string,
  semitons: number,
  preferirBemol: boolean,
  modoVisualizacao: "completo" | "grupo1" | "grupo2"
) {
  // 1. Linha indicativa de Tom
  if (/^tom\s*:/i.test(linha)) {
    const partes = linha.split(/:\s*/);
    const tomOriginal = partes[1]?.trim() || "";
    const tomFinal = semitons === 0 ? tomOriginal : transporGrupo1(tomOriginal, semitons, preferirBemol);

    if (modoVisualizacao === "grupo2") return <span className="font-bold text-gray-900">{partes[0]}:</span>;
    if (modoVisualizacao === "grupo1") return <span className="text-[#FF5500] font-mono text-base font-bold">{tomFinal}</span>;
    return (
      <span className="font-bold text-gray-900">
        {partes[0]}: <span className="text-[#FF5500] font-mono text-base font-bold">{tomFinal}</span>
      </span>
    );
  }

  // 2. Linha indicativa de Afinação
  if (/^afina[cç][aã]o\s*:/i.test(linha)) {
    if (modoVisualizacao === "grupo1") return <span className="text-transparent"> </span>;
    return <span className="font-bold text-gray-900">{linha}</span>;
  }

  // 3. Linhas de Tablatura ASCII (Grupo 2 - Intocáveis)
  if (/^[EBGDAE]\s*\|/i.test(linha) || /\|[-0-9\s/\\hpbr~|]+\|/.test(linha)) {
    if (modoVisualizacao === "grupo1") return <span className="text-transparent"> </span>;
    return <span className="text-gray-900 font-mono select-text">{linha}</span>;
  }

  // 4. Demais linhas contendo cifras e texto do arquivo carregado
  const tokens = linha.split(/(\s+|\[|\]|\(|\))/);

  return (
    <span>
      {tokens.map((token, i) => {
        const limpo = token.trim();
        const ehGrupo1 = limpo && REGEX_GRUPO1_CIFRA.test(limpo);

        if (ehGrupo1) {
          if (modoVisualizacao === "grupo2") return <span key={i} className="opacity-0">{" ".repeat(limpo.length)}</span>;
          const transposta = semitons === 0 ? limpo : transporGrupo1(limpo, semitons, preferirBemol);
          return (
            <span key={i} className="text-[#FF5500] font-bold font-mono">
              {transposta}
            </span>
          );
        } else {
          if (modoVisualizacao === "grupo1") return <span key={i}> </span>;
          return <span key={i}>{token}</span>;
        }
      })}
    </span>
  );
}

function TranspositorDinamicoReal() {
  const navigate = useNavigate();

  const [documentoTexto, setDocumentoTexto] = useState<string>("");
  const [hasFile, setHasFile] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [isEditing, setIsEditing] = useState<boolean>(false);

  const [modoVisualizacao, setModoVisualizacao] = useState<"completo" | "grupo1" | "grupo2">("completo");

  const [tomReconhecido, setTomReconhecido] = useState<string>("C");
  const [tomDesejado, setTomDesejado] = useState<string>("C");
  const [instrumentoId, setInstrumentoId] = useState<string>("original");

  const calcularSemitons = (): number => {
    const idxOrig = NOTAS_SEMITONS[tomReconhecido];
    const idxDest = NOTAS_SEMITONS[tomDesejado];
    if (idxOrig === undefined || idxDest === undefined) return 0;
    return (idxDest - idxOrig + 12) % 12;
  };

  const deltaSemitons = calcularSemitons();
  const preferirBemol = tomDesejado.includes("b") || instrumentoId === "Eb" || instrumentoId === "Bb";

  // Identifica dinamicamente o tom dentro do texto do novo arquivo enviado
  const detectarTomNoTexto = (conteudo: string): string => {
    const match = conteudo.match(/(?:tom|key)\s*:\s*([A-G][#b]?)/i);
    if (match && match[1]) {
      const achado = match[1].toUpperCase();
      if (NOTAS_SEMITONS[achado] !== undefined) return achado;
    }

    const palavras = conteudo.split(/\s+/);
    for (const pal of palavras) {
      const limpo = pal.replace(/[\[\](),]/g, "");
      if (REGEX_GRUPO1_CIFRA.test(limpo)) {
        const raiz = limpo.match(/^([A-G][#b]?)/)?.[1];
        if (raiz && NOTAS_SEMITONS[raiz] !== undefined) return raiz;
      }
    }

    return "C";
  };

  const processarTextoCarregado = (textoLido: string) => {
    setDocumentoTexto(textoLido);
    const tomAuto = detectarTomNoTexto(textoLido);
    setTomReconhecido(tomAuto);
    setTomDesejado(tomAuto);
    setInstrumentoId("original");
    setHasFile(true);
    setIsProcessing(false);
    toast.success("Novo arquivo processado com sucesso!", {
      description: `Tom detectado: ${tomAuto}. Exibindo o conteúdo real carregado.`,
    });
  };

  // Leitor OCR universal de imagens usando Tesseract.js no navegador
  const extrairTextoDeImagem = async (file: File) => {
    setIsProcessing(true);
    setStatusMessage("A analisar a imagem enviada...");

    try {
      if (!(window as any).Tesseract) {
        await new Promise((resolve, reject) => {
          const s = document.createElement("script");
          s.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
          s.async = true;
          s.onload = resolve;
          s.onerror = reject;
          document.body.appendChild(s);
        });
      }

      const Tesseract = (window as any).Tesseract;
      setStatusMessage("Reconhecendo texto e cifras da nova imagem...");

      const worker = await Tesseract.createWorker("por");
      const ret = await worker.recognize(file);
      await worker.terminate();

      const resultadoOCR = ret.data.text.trim();
      if (resultadoOCR.length > 5) {
        processarTextoCarregado(resultadoOCR);
      } else {
        throw new Error("Texto extraído muito curto.");
      }
    } catch (err) {
      console.warn("Aviso no OCR da imagem:", err);
      // Se a imagem estiver muito escura ou sem foco, abre o editor para colar ou digitar o texto real da foto
      setIsEditing(true);
      processarTextoCarregado(
        `[Arquivo: ${file.name}]\nTom: C\nAfinação: E A D G B E\n\n(Insira ou cole o conteúdo da sua cifra aqui...)`
      );
      toast.info("Ajuste o texto na caixa de edição caso necessário.");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type.includes("text") || file.name.endsWith(".txt") || file.name.endsWith(".cifra") || file.name.endsWith(".md")) {
      setIsProcessing(true);
      setStatusMessage("Lendo arquivo...");
      const reader = new FileReader();
      reader.onload = (event) => processarTextoCarregado(event.target?.result as string);
      reader.readAsText(file);
    } else {
      extrairTextoDeImagem(file);
    }

    e.target.value = "";
  };

  const handleSelectInstrumento = (id: string) => {
    setInstrumentoId(id);
    if (id === "original") {
      setTomDesejado(tomReconhecido);
      return;
    }

    const inst = INSTRUMENTOS_PRESET.find((i) => i.id === id);
    if (!inst) return;

    const valOrig = NOTAS_SEMITONS[tomReconhecido] || 0;
    const novoVal = (valOrig + inst.semitons) % 12;
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
              Scanner Dinâmico Universal
            </h1>
            <p className="text-[10px] text-gray-400 font-mono">
              Reconhece e processa qualquer ficheiro enviado
            </p>
          </div>
        </div>

        {hasFile && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="text-gray-300 hover:text-white p-1.5 rounded-lg border border-gray-700 text-xs flex items-center gap-1 bg-[#141824]"
              title="Ajustar texto"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{isEditing ? "Concluir" : "Editar"}</span>
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs px-2.5 py-1.5 rounded-lg border border-gray-700 transition"
              title="Imprimir ou Salvar PDF"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir</span>
            </button>
            <button
              onClick={() => setHasFile(false)}
              className="text-gray-400 hover:text-white p-1.5 rounded-lg border border-gray-800 text-xs"
              title="Carregar outro ficheiro"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-4 space-y-4 print:p-0 print:max-w-none">
        {/* Painel Inicial de Upload (Sempre limpo para novos arquivos) */}
        {!hasFile ? (
          <div className="p-8 border-2 border-dashed border-gray-800 rounded-2xl bg-[#0F121A] flex flex-col items-center justify-center text-center shadow-xl space-y-3">
            <div className="p-4 rounded-full bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/30">
              <Layers className="w-8 h-8" />
            </div>
            <h2 className="text-base font-bold text-white">Carregar Nova Cifra ou Ficheiro</h2>
            <p className="text-xs text-gray-400 max-w-sm leading-relaxed">
              Envie qualquer fotografia ou documento. O sistema lerá o conteúdo real do ficheiro enviado, sem utilizar modelos anteriores.
            </p>

            <div className="flex gap-2 w-full max-w-xs pt-2">
              <label className="flex-1 cursor-pointer">
                <span className="inline-flex w-full items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs py-2.5 px-3 rounded-xl shadow-lg transition">
                  <Camera className="w-4 h-4" /> Câmera
                </span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              <label className="flex-1 cursor-pointer">
                <span className="inline-flex w-full items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-white font-bold text-xs py-2.5 px-3 rounded-xl border border-gray-700 transition">
                  <Upload className="w-4 h-4 text-gray-400" /> Ficheiro
                </span>
                <input
                  type="file"
                  accept="image/*,.txt,.cifra,.pdf,.md"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            {isProcessing && (
              <div className="flex flex-col items-center gap-2 pt-3">
                <Sparkles className="w-6 h-6 text-amber-400 animate-spin" />
                <span className="text-xs text-amber-300 font-medium">{statusMessage}</span>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* PAINEL DE CONTROLE DE TRANSPOSIÇÃO E GRUPOS */}
            <div className="bg-[#0F121A] p-4 rounded-2xl border border-gray-800 shadow-lg space-y-3 print:hidden">
              <div className="flex items-center justify-between border-b border-gray-800 pb-2">
                <span className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                  <Music2 className="w-4 h-4 text-emerald-400" />
                  Controle de Transposição & Grupos
                </span>
                <span className="text-[11px] font-mono font-bold text-amber-400">
                  {deltaSemitons === 0 ? "Original (0 semitons)" : `${deltaSemitons > 0 ? `+${deltaSemitons}` : deltaSemitons} semitons`}
                </span>
              </div>

              {/* Abas de Visualização (Completo / Grupo 1 / Grupo 2) */}
              <div>
                <label className="text-[10px] text-gray-400 font-bold block mb-1">
                  Modo de Exibição dos Grupos:
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    onClick={() => setModoVisualizacao("completo")}
                    className={`py-1.5 text-[10px] font-bold rounded-lg border transition ${
                      modoVisualizacao === "completo"
                        ? "bg-amber-500 text-black border-amber-500"
                        : "bg-[#161B26] text-gray-300 border-gray-800"
                    }`}
                  >
                    Completo (Final)
                  </button>
                  <button
                    onClick={() => setModoVisualizacao("grupo1")}
                    className={`py-1.5 text-[10px] font-bold rounded-lg border transition ${
                      modoVisualizacao === "grupo1"
                        ? "bg-amber-500 text-black border-amber-500"
                        : "bg-[#161B26] text-gray-300 border-gray-800"
                    }`}
                  >
                    Grupo 1 (Apenas Cifras)
                  </button>
                  <button
                    onClick={() => setModoVisualizacao("grupo2")}
                    className={`py-1.5 text-[10px] font-bold rounded-lg border transition ${
                      modoVisualizacao === "grupo2"
                        ? "bg-amber-500 text-black border-amber-500"
                        : "bg-[#161B26] text-gray-300 border-gray-800"
                    }`}
                  >
                    Grupo 2 (Apenas Intocável)
                  </button>
                </div>
              </div>

              {/* Atalhos de Instrumento */}
              <div>
                <label className="text-[10px] text-gray-400 font-bold block mb-1">
                  Transpor Grupo 1 Direto Para:
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

              {/* Seletores de Tom */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-[10px] text-gray-400 font-bold block mb-1">
                    Tom Reconhecido:
                  </label>
                  <select
                    value={tomReconhecido}
                    onChange={(e) => {
                      const novo = e.target.value;
                      setTomReconhecido(novo);
                      if (instrumentoId === "original") setTomDesejado(novo);
                    }}
                    className="w-full bg-[#161B26] border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs font-bold text-red-400 outline-none"
                  >
                    {TONS_DISPONIVEIS.map((t) => (
                      <option key={`orig-${t}`} value={t} className="bg-[#10131C] text-white">
                        Tom: {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-amber-400 font-bold block mb-1">
                    Novo Tom Desejado (Grupo 1):
                  </label>
                  <select
                    value={tomDesejado}
                    onChange={(e) => {
                      setTomDesejado(e.target.value);
                      setInstrumentoId("custom");
                    }}
                    className="w-full bg-[#161B26] border border-amber-500/50 rounded-lg px-2.5 py-1.5 text-xs font-bold text-amber-400 outline-none"
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

            {/* Editor de Texto Dinâmico */}
            {isEditing && (
              <div className="bg-[#0F121A] p-3 rounded-xl border border-gray-700 space-y-2">
                <span className="text-xs font-bold text-amber-400">Texto Extraído do Novo Arquivo:</span>
                <textarea
                  value={documentoTexto}
                  onChange={(e) => setDocumentoTexto(e.target.value)}
                  className="w-full h-44 bg-[#080A0F] border border-gray-800 rounded-lg p-2.5 font-mono text-xs text-gray-200 outline-none"
                />
              </div>
            )}

            {/* DOCUMENTO FINAL RENDERIZADO */}
            <div className="bg-white text-black p-8 sm:p-12 rounded-xl shadow-2xl border border-gray-300 font-sans print:shadow-none print:border-none print:p-0">
              <div className="space-y-1 font-mono text-xs sm:text-sm whitespace-pre-wrap leading-relaxed">
                {documentoTexto.split("\n").map((linha, index) => (
                  <div key={index} className="min-h-[1.2rem]">
                    {renderizarLinhaPorGrupos(linha, deltaSemitons, preferirBemol, modoVisualizacao)}
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
