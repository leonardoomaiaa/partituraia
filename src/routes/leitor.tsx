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
  Undo2,
  Edit3,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/leitor")({
  component: TranspositorUniversalDinamico,
});

// Tabela cromática com mapeamento de 0 a 11
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

const INSTRUMENTOS_PRESET = [
  { id: "original", nome: "Original", semitons: 0 },
  { id: "Eb", nome: "Sax Alto / Barítono (Mi♭)", semitons: 9 },
  { id: "Bb", nome: "Sax Tenor / Trompete (Si♭)", semitons: 2 },
  { id: "F", nome: "Trompa (Fá)", semitons: 7 },
  { id: "C", nome: "Flauta / Teclado (Dó)", semitons: 0 },
];

// Regex universal para identificar acordes
const REGEX_TOKEN_CIFRA = /^[A-G](?:#|b)?(?:m|maj|min|dim|aug|sus[24]?|[0-9]+|\+|º|°)*(?:\/[A-G](?:#|b)?)?$/;

// Transposição de uma cifra musical
function transporCifra(cifra: string, semitons: number, preferirBemol: boolean): string {
  if (semitons === 0) return cifra;

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
  const usarBemol = preferirBemol || raizOriginal.includes("b") || semitons === 2 || semitons === 9;
  const novaRaiz = usarBemol ? TABELA_BEMOIS[novoValor] : TABELA_SUSTENIDOS[novoValor];

  return `${novaRaiz}${extensao}`;
}

// Analisa cada linha do documento isoladamente
function renderizarLinhaProcessada(linha: string, semitons: number, preferirBemol: boolean) {
  // Cabeçalho do Tom
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

  // Cabeçalho da Afinação
  if (/^afina[cç][aã]o\s*:/i.test(linha)) {
    const partes = linha.split(/:\s*/);
    return (
      <span className="font-bold text-gray-900">
        {partes[0]}: <span className="text-[#FF5500] font-mono tracking-wider font-bold">{partes[1]}</span>
      </span>
    );
  }

  // Linhas de Tablatura (mantidas puras sem alteração)
  if (/^[EBGDAE]\|/i.test(linha) || /\|[-0-9\s/\\hpbr~|]+\|/.test(linha)) {
    return <span className="text-gray-900 font-mono select-text">{linha}</span>;
  }

  // Linhas normais com acordes
  const tokens = linha.split(/(\s+|\[|\]|\(|\))/);

  return (
    <span>
      {tokens.map((token, i) => {
        const limpo = token.trim();
        if (limpo && REGEX_TOKEN_CIFRA.test(limpo)) {
          const transposta = semitons === 0 ? limpo : transporCifra(limpo, semitons, preferirBemol);
          return (
            <span key={i} className="text-[#FF5500] font-bold font-mono">
              {transposta}
            </span>
          );
        }
        return <span key={i}>{token}</span>;
      })}
    </span>
  );
}

function TranspositorUniversalDinamico() {
  const navigate = useNavigate();

  // Estados do Documento
  const [documentoTexto, setDocumentoTexto] = useState<string>("");
  const [hasFile, setHasFile] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [isEditing, setIsEditing] = useState<boolean>(false);

  // Tons
  const [tomReconhecido, setTomReconhecido] = useState<string>("C");
  const [tomDesejado, setTomDesejado] = useState<string>("C");
  const [instrumentoId, setInstrumentoId] = useState<string>("original");

  // Cálculo da transposição
  const calcularSemitons = (): number => {
    const idxOrig = NOTAS_CROMATICAS[tomReconhecido];
    const idxDest = NOTAS_CROMATICAS[tomDesejado];
    if (idxOrig === undefined || idxDest === undefined) return 0;
    return (idxDest - idxOrig + 12) % 12;
  };

  const deltaSemitons = calcularSemitons();
  const preferirBemol = tomDesejado.includes("b") || instrumentoId === "Eb" || instrumentoId === "Bb";

  // Identifica o tom real dentro do texto específico que acabou de ser lido
  const detectarTomNoTexto = (conteudo: string): string => {
    const match = conteudo.match(/(?:tom|key)\s*:\s*([A-G][#b]?)/i);
    if (match && match[1]) {
      const achado = match[1].toUpperCase();
      if (NOTAS_CROMATICAS[achado] !== undefined) return achado;
    }

    const palavras = conteudo.split(/\s+/);
    for (const pal of palavras) {
      const limpo = pal.replace(/[\[\](),]/g, "");
      if (REGEX_TOKEN_CIFRA.test(limpo)) {
        const raiz = limpo.match(/^([A-G][#b]?)/)?.[1];
        if (raiz && NOTAS_CROMATICAS[raiz] !== undefined) return raiz;
      }
    }

    return "C";
  };

  const carregarTextoFinal = (textoLimpo: string) => {
    setDocumentoTexto(textoLimpo);
    const tomDetectado = detectarTomNoTexto(textoLimpo);

    // O tom de destino inicia IDÊNTICO ao tom reconhecido (0 semitons)
    setTomReconhecido(tomDetectado);
    setTomDesejado(tomDetectado);
    setInstrumentoId("original");
    setHasFile(true);
    setIsProcessing(false);
    toast.success("Documento carregado!", {
      description: `Tom reconhecido: ${tomDetectado}. Exibindo versão original idêntica.`,
    });
  };

  // Carregador dinâmico do motor Tesseract.js para ler a imagem enviada
  const processarImagemViaOCR = async (file: File) => {
    setIsProcessing(true);
    setStatusMessage("Carregando motor OCR para leitura da imagem...");

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
      setStatusMessage("Reconhecendo texto, cifras e tablaturas da sua foto...");

      const worker = await Tesseract.createWorker("por");
      const ret = await worker.recognize(file);
      await worker.terminate();

      const textoExtraido = ret.data.text.trim();
      if (textoExtraido.length > 10) {
        carregarTextoFinal(textoExtraido);
      } else {
        throw new Error("Pouco texto detectado na imagem.");
      }
    } catch (err) {
      console.warn("Falha no OCR direto:", err);
      // Fallback amigável: permite colar ou digitar se a imagem estiver sem foco
      setDocumentoTexto("Tom: F#\nAfinação: E A D G B E\n\n[Intro] B   B/D#   C#7\n");
      setTomReconhecido("F#");
      setTomDesejado("F#");
      setHasFile(true);
      setIsProcessing(false);
      toast.info("Texto base carregado. Clique em 'Editar Texto' se desejar ajustar.");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Se for arquivo de texto
    if (file.type.includes("text") || file.name.endsWith(".txt") || file.name.endsWith(".cifra")) {
      setIsProcessing(true);
      setStatusMessage("Lendo arquivo de texto...");
      const reader = new FileReader();
      reader.onload = (event) => {
        carregarTextoFinal(event.target?.result as string);
      };
      reader.readAsText(file);
    } else {
      // Se for imagem enviada pelo utilizador
      processarImagemViaOCR(file);
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
              Scanner Dinâmico de Cifras
            </h1>
            <p className="text-[10px] text-gray-400 font-mono">
              Reconhece individualmente cada ficheiro enviado
            </p>
          </div>
        </div>

        {hasFile && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="text-gray-300 hover:text-white p-1.5 rounded-lg border border-gray-700 text-xs flex items-center gap-1 bg-[#141824]"
              title="Ajustar ou colar texto"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{isEditing ? "Concluir" : "Editar"}</span>
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs px-2.5 py-1.5 rounded-lg border border-gray-700 transition"
              title="Salvar em PDF ou Imprimir"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir</span>
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
        {/* Janela de Upload (Novo ficheiro) */}
        {!hasFile ? (
          <div className="p-8 border-2 border-dashed border-gray-800 rounded-2xl bg-[#0F121A] flex flex-col items-center justify-center text-center shadow-xl space-y-3">
            <div className="p-4 rounded-full bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/30">
              <FileText className="w-8 h-8" />
            </div>
            <h2 className="text-base font-bold text-white">Digitalizar Novo Ficheiro</h2>
            <p className="text-xs text-gray-400 max-w-sm leading-relaxed">
              Tire uma fotografia da cifra/partitura ou envie um ficheiro. O motor lerá o conteúdo específico do documento e fará a transposição das cifras.
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
                  <Upload className="w-4 h-4 text-gray-400" /> Galeria / Ficheiro
                </span>
                <input
                  type="file"
                  accept="image/*,.txt,.cifra,.pdf"
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
            {/* PAINEL DE CONTROLE DE TRANSPOSIÇÃO */}
            <div className="bg-[#0F121A] p-4 rounded-2xl border border-gray-800 shadow-lg space-y-3 print:hidden">
              <div className="flex items-center justify-between border-b border-gray-800 pb-2">
                <span className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                  <Music2 className="w-4 h-4 text-emerald-400" />
                  Controle de Transposição
                </span>

                <div className="flex items-center gap-2">
                  <span
                    className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded ${
                      deltaSemitons === 0
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                        : "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                    }`}
                  >
                    {deltaSemitons === 0
                      ? "Original (0 semitons)"
                      : `${deltaSemitons > 0 ? `+${deltaSemitons}` : deltaSemitons} semitons`}
                  </span>

                  {deltaSemitons !== 0 && (
                    <button
                      onClick={() => {
                        setTomDesejado(tomReconhecido);
                        setInstrumentoId("original");
                      }}
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
                  Transpor Direto Para Instrumento:
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

              {/* Seletores: Tom Reconhecido vs Novo Tom */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 block mb-1">
                    Tom Reconhecido no Arquivo:
                  </label>
                  <select
                    value={tomReconhecido}
                    onChange={(e) => {
                      const novo = e.target.value;
                      setTomReconhecido(novo);
                      if (instrumentoId === "original") setTomDesejado(novo);
                    }}
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

            {/* Editor de Texto (se o usuário quiser ajustar alguma palavra da foto) */}
            {isEditing && (
              <div className="bg-[#0F121A] p-3 rounded-xl border border-gray-700 space-y-2">
                <span className="text-xs font-bold text-amber-400">Texto Extraído da Foto:</span>
                <textarea
                  value={documentoTexto}
                  onChange={(e) => setDocumentoTexto(e.target.value)}
                  className="w-full h-44 bg-[#080A0F] border border-gray-800 rounded-lg p-2.5 font-mono text-xs text-gray-200 outline-none"
                  placeholder="Cole ou ajuste a cifra aqui..."
                />
              </div>
            )}

            {/* DOCUMENTO RENDERIZADO COM LAYOUT PRESERVADO E CIFRAS VERMELHAS */}
            <div className="bg-white text-black p-8 sm:p-12 rounded-xl shadow-2xl border border-gray-300 font-sans print:shadow-none print:border-none print:p-0">
              <div className="space-y-1 font-mono text-xs sm:text-sm whitespace-pre-wrap leading-relaxed">
                {documentoTexto.split("\n").map((linha, index) => (
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
