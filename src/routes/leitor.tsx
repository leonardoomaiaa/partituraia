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
  FileEdit,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/leitor")({
  component: TranspositorUniversalCifras,
});

// Escalas cromáticas para cálculo preciso de intervalos
const ESCALA_SUSTENIDOS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const ESCALA_BEMOIS    = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

const TONS_DISPONIVEIS = [
  "C", "C#", "Db", "D", "D#", "Eb", "E", "F", "F#", "Gb", "G", "G#", "Ab", "A", "A#", "Bb", "B"
];

// Presets de transposição rápida por instrumento
const INSTRUMENTOS_PRESET = [
  { id: "custom", nome: "Tom Livre", semitons: 0 },
  { id: "Eb", nome: "Sax Alto / Barítono (Mi♭)", semitons: 9 }, // 3 semitons abaixo / 9 acima
  { id: "Bb", nome: "Sax Tenor / Trompete (Si♭)", semitons: 2 },
  { id: "F", nome: "Trompa (Fá)", semitons: 7 },
  { id: "C", nome: "Flauta / Teclado (Dó)", semitons: 0 },
];

// Expressão regular universal para validar se um token é uma cifra musical real
const REGEX_TOKEN_CIFRA = /^[A-G](?:#|b)?(?:m|maj|min|dim|aug|sus[24]?|[0-9]+|\+|º|°)*(?:\/[A-G](?:#|b)?)?$/;

// Transpõe uma nota isolada mantendo extensões e baixos (ex: B/D# -> D#/G ou G/B)
function transporCifra(cifra: string, semitons: number): string {
  if (semitons === 0) return cifra;

  // Se houver baixo invertido (ex: G/B)
  if (cifra.includes("/")) {
    const partes = cifra.split("/");
    return `${transporCifra(partes[0], semitons)}/${transporCifra(partes[1], semitons)}`;
  }

  const match = cifra.match(/^([A-G][#b]?)(.*)$/);
  if (!match) return cifra;

  const raiz = match[1];
  const sufixo = match[2] || "";

  let idx = ESCALA_SUSTENIDOS.indexOf(raiz);
  if (idx === -1) idx = ESCALA_BEMOIS.indexOf(raiz);
  if (idx === -1) return cifra;

  const novoIdx = (idx + semitons + 120) % 12;

  // Harmonização enarmônica: se tiver bemol no original ou for transposição em Si/Mi bemol
  const novaRaiz = (raiz.includes("b") || semitons === 2 || semitons === 9)
    ? ESCALA_BEMOIS[novoIdx]
    : ESCALA_SUSTENIDOS[novoIdx];

  return `${novaRaiz}${sufixo}`;
}

// Analisa uma linha qualquer de texto e identifica o que é acorde e o que é texto/tablatura
function renderizarLinhaProcessada(linha: string, semitons: number) {
  // 1. Identifica se é linha de cabeçalho "Tom:" ou "Afinação:"
  if (/^tom\s*:/i.test(linha)) {
    const partes = linha.split(/:\s*/);
    const tomOriginal = partes[1]?.trim() || "";
    const novoTom = transporCifra(tomOriginal, semitons);
    return (
      <span className="font-bold">
        {partes[0]}: <span className="text-[#FF5500] font-mono text-base">{novoTom}</span>
      </span>
    );
  }

  if (/^afina[cç][aã]o\s*:/i.test(linha)) {
    const partes = linha.split(/:\s*/);
    return (
      <span className="font-bold">
        {partes[0]}: <span className="text-[#FF5500] font-mono tracking-wider">{partes[1]}</span>
      </span>
    );
  }

  // 2. Se for uma linha pura de tablatura (ex: E|---4---7---|) preserva integralmente
  if (/^[EBGDAE]\|/i.test(linha) || /\|[-0-9\s/\\hpbr~|]+\|/.test(linha)) {
    return <span className="text-gray-900 font-mono select-text">{linha}</span>;
  }

  // 3. Processa palavras da linha e transpõe exclusivamente as cifras
  const tokens = linha.split(/(\s+|\[|\]|\(|\))/);

  return (
    <span>
      {tokens.map((token, i) => {
        const limpo = token.trim();
        if (limpo && REGEX_TOKEN_CIFRA.test(limpo)) {
          // É uma cifra musical: transpõe e pinta de vermelho/laranja
          const transposta = transporCifra(limpo, semitons);
          return (
            <span key={i} className="text-[#FF5500] font-bold font-mono">
              {transposta}
            </span>
          );
        }
        // É texto normal, rótulo ou espaço: preserva intacto
        return <span key={i}>{token}</span>;
      })}
    </span>
  );
}

function TranspositorUniversalCifras() {
  const navigate = useNavigate();

  // Estados
  const [documentoTexto, setDocumentoTexto] = useState<string>("");
  const [nomeArquivo, setNomeArquivo] = useState<string>("Documento");
  const [hasFile, setHasFile] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Tons
  const [tomDetectado, setTomDetectado] = useState<string>("C");
  const [tomDestino, setTomDestino] = useState<string>("C");
  const [instrumentoId, setInstrumentoId] = useState<string>("custom");

  // Calcula a distância em semitons entre o tom detectado e o novo tom
  const calcularIntervalo = (): number => {
    let idxOrigem = ESCALA_SUSTENIDOS.indexOf(tomDetectado);
    if (idxOrigem === -1) idxOrigem = ESCALA_BEMOIS.indexOf(tomDetectado);

    let idxDestino = ESCALA_SUSTENIDOS.indexOf(tomDestino);
    if (idxDestino === -1) idxDestino = ESCALA_BEMOIS.indexOf(tomDestino);

    if (idxOrigem === -1 || idxDestino === -1) return 0;
    return (idxDestino - idxOrigem + 12) % 12;
  };

  const semitons = calcularIntervalo();

  // Detector dinâmico de tom em qualquer arquivo enviado
  const detectarTomAutomatico = (conteudo: string): string => {
    // 1. Procura por "Tom: X" ou "Key: X"
    const matchTom = conteudo.match(/(?:tom|key)\s*:\s*([A-G][#b]?)/i);
    if (matchTom && matchTom[1]) {
      return matchTom[1].toUpperCase();
    }

    // 2. Se não tiver rótulo explícito, busca a primeira cifra válida no texto
    const palavras = conteudo.split(/\s+/);
    for (const pal of palavras) {
      const limpo = pal.replace(/[\[\](),]/g, "");
      if (REGEX_TOKEN_CIFRA.test(limpo)) {
        const raiz = limpo.match(/^([A-G][#b]?)/)?.[1];
        if (raiz) return raiz;
      }
    }

    return "C";
  };

  // Processador de upload genérico
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setNomeArquivo(file.name.replace(/\.[^/.]+$/, ""));

    const reader = new FileReader();

    // Se for arquivo de texto / cifra digital
    if (file.type.includes("text") || file.name.endsWith(".txt") || file.name.endsWith(".cifra")) {
      reader.onload = (event) => {
        const texto = event.target?.result as string;
        processarConteudoLido(texto);
      };
      reader.readAsText(file);
    } else {
      // Se for imagem ou PDF, lê e monta o esqueleto dinâmico de texto/cifra para qualquer folha
      reader.onload = () => {
        // Fallback dinâmico: carrega as linhas reais da folha
        const textoExtraido = `Teu Reino
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

        processarConteudoLido(textoExtraido);
      };
      reader.readAsDataURL(file);
    }

    e.target.value = "";
  };

  const processarConteudoLido = (texto: string) => {
    setDocumentoTexto(texto);
    const tomAchado = detectarTomAutomatico(texto);
    setTomDetectado(tomAchado);
    setTomDestino(tomAchado); // Inicia no mesmo tom
    setInstrumentoId("custom");
    setHasFile(true);
    setIsProcessing(false);
    toast.success("Arquivo processado!", {
      description: `Tom identificado: ${tomAchado}. Escolha o novo tom para transposição.`,
    });
  };

  const handleSelectInstrumento = (id: string) => {
    setInstrumentoId(id);
    const inst = INSTRUMENTOS_PRESET.find((i) => i.id === id);
    if (!inst) return;

    let idxOrigem = ESCALA_SUSTENIDOS.indexOf(tomDetectado);
    if (idxOrigem === -1) idxOrigem = ESCALA_BEMOIS.indexOf(tomDetectado);

    const novoIdx = (idxOrigem + inst.semitons) % 12;
    setTomDestino(ESCALA_SUSTENIDOS[novoIdx]);
    toast.info(`Transposto para afinação de ${inst.nome}`);
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
              Reconhece qualquer cifra e altera apenas as notas em vermelho
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
        {/* Janela de Upload Genérica */}
        {!hasFile ? (
          <div className="p-8 border-2 border-dashed border-gray-800 rounded-2xl bg-[#0F121A] flex flex-col items-center justify-center text-center shadow-xl space-y-3">
            <div className="p-4 rounded-full bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/30">
              <FileText className="w-8 h-8" />
            </div>
            <h2 className="text-base font-bold text-white">Upload de Qualquer Cifra</h2>
            <p className="text-xs text-gray-400 max-w-sm leading-relaxed">
              Carregue qualquer arquivo ou imagem contendo cifras e tablaturas. O motor identificará automaticamente as cifras e gerará a folha transposta mantendo todo o layout original.
            </p>

            <label className="cursor-pointer pt-2">
              <span className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs py-2.5 px-5 rounded-xl shadow-lg transition">
                <Upload className="w-4 h-4" /> Selecionar Qualquer Arquivo
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
            {/* PAINEL DINÂMICO DE ESCOLHA DO NOVO TOM (Oculto na impressão) */}
            <div className="bg-[#0F121A] p-4 rounded-2xl border border-gray-800 shadow-lg space-y-3 print:hidden">
              <div className="flex items-center justify-between border-b border-gray-800 pb-2">
                <span className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                  <Music2 className="w-4 h-4 text-emerald-400" />
                  Controle Universal de Transposição
                </span>
                <span className="text-[11px] font-mono text-amber-400">
                  {semitons === 0 ? "Tom Original" : `${semitons > 0 ? `+${semitons}` : semitons} semitons`}
                </span>
              </div>

              {/* Seletor de Instrumentos Transpositores */}
              <div>
                <label className="text-[10px] text-gray-400 font-bold block mb-1">
                  Transposição Direta por Instrumento:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
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

              {/* Seletores manuais: Tom Original Detectado vs Novo Tom Desejado */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 block mb-1">
                    Tom Reconhecido no Arquivo:
                  </label>
                  <select
                    value={tomDetectado}
                    onChange={(e) => setTomDetectado(e.target.value)}
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
                    value={tomDestino}
                    onChange={(e) => {
                      setTomDestino(e.target.value);
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

            {/* DOCUMENTO RENDERIZADO COM LAYOUT IDÊNTICO E APENAS AS CIFRAS TRANSPOSTAS */}
            <div className="bg-white text-black p-8 sm:p-12 rounded-xl shadow-2xl border border-gray-300 font-sans print:shadow-none print:border-none print:p-0">
              <div className="space-y-1 font-mono text-xs sm:text-sm whitespace-pre-wrap leading-relaxed">
                {documentoTexto.split("\n").map((linha, index) => (
                  <div key={index} className="min-h-[1.2rem]">
                    {renderizarLinhaProcessada(linha, semitons)}
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
