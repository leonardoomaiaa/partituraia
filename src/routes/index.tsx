import React from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { BottomNav } from "@/components/BottomNav";
import {
  Camera,
  Music2,
  ArrowRight,
  Sparkles,
  Gauge,
  Timer,
  SlidersHorizontal,
} from "lucide-react";

export const Route = createFileRoute("/")({
  component: IndexRoute,
});

function IndexRoute() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#07090E] text-white flex flex-col justify-between pb-24 select-none">
      {/* Cabeçalho */}
      <header className="px-5 py-4 bg-[#10131C]/95 backdrop-blur border-b border-gray-800 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Music2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white tracking-wide flex items-center gap-1.5">
              PartituraIA
              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.2 rounded border border-emerald-500/40 font-mono">
                PWA
              </span>
            </h1>
            <p className="text-[11px] text-gray-400">Transpositor & Ferramentas Musicais</p>
          </div>
        </div>
      </header>

      {/* Conteúdo Principal / Cards */}
      <main className="flex-1 max-w-lg mx-auto w-full px-5 py-6 space-y-4">
        {/* Banner de Boas-vindas */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-[#10141F] to-amber-950/30 border border-emerald-500/20 shadow-lg">
          <div className="flex items-center gap-2 mb-1.5 text-emerald-400 text-xs font-semibold">
            <Sparkles className="w-4 h-4" />
            <span>Ferramentas de Alta Precisão</span>
          </div>
          <p className="text-xs text-gray-300 leading-relaxed">
            Selecione uma das opções abaixo para transpor notas, digitalizar partituras ou usar ferramentas acústicas.
          </p>
        </div>

        {/* CARD 1: DIGITALIZAR PARTITURA (PRO) -> AGORA NAVEGA DIRETO PARA /leitor */}
        <div
          onClick={() => navigate({ to: "/leitor" })}
          className="group relative p-4 rounded-2xl bg-[#0F121A] border border-amber-500/30 hover:border-amber-400/60 transition-all duration-200 cursor-pointer shadow-xl active:scale-[0.99]"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-start gap-3.5">
              <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/30 group-hover:scale-105 transition-transform">
                <Camera className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-white group-hover:text-amber-400 transition-colors">
                    Digitalizar Partitura
                  </h2>
                  <span className="text-[9px] bg-amber-500 text-black px-1.5 py-0.5 rounded font-black tracking-wide">
                    PRO
                  </span>
                </div>
                <p className="text-xs text-gray-400 leading-snug max-w-[260px]">
                  Fotografe a partitura e deixe a leitura das notas por conta do app.
                </p>
                <div className="pt-1 flex items-center gap-1.5 text-[10px] text-amber-400 font-mono">
                  <span>[⛶] SCANNER OMR</span>
                </div>
              </div>
            </div>

            <div className="text-gray-500 group-hover:text-amber-400 group-hover:translate-x-1 transition-all">
              <ArrowRight className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* CARD 2: ENTRADA MANUAL DE NOTAS */}
        <div
          onClick={() => navigate({ to: "/teclado" })}
          className="group relative p-4 rounded-2xl bg-[#0F121A] border border-gray-800 hover:border-emerald-500/50 transition-all duration-200 cursor-pointer shadow-xl active:scale-[0.99]"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-start gap-3.5">
              <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 group-hover:scale-105 transition-transform">
                <Music2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h2 className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors">
                  Entrada Manual
                </h2>
                <p className="text-xs text-gray-400 leading-snug max-w-[260px]">
                  Digite as notas no teclado interativo e transponha entre Dó, Mi♭, Si♭ e Fá instantaneamente.
                </p>
                <div className="pt-1 flex items-center gap-1.5 text-[10px] text-emerald-400 font-mono">
                  <span>TECLADO VIRTUAL</span>
                </div>
              </div>
            </div>

            <div className="text-gray-500 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all">
              <ArrowRight className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* ATALHOS RÁPIDOS: AFINADOR E METRÔNOMO */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <div
            onClick={() => navigate({ to: "/afinador" })}
            className="p-3.5 rounded-xl bg-[#0F121A] border border-gray-800 hover:border-gray-700 cursor-pointer transition flex items-center gap-3"
          >
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
              <Gauge className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-white">Afinador</h3>
              <p className="text-[10px] text-gray-400">Cromático em Hz</p>
            </div>
          </div>

          <div
            onClick={() => navigate({ to: "/metronomo" })}
            className="p-3.5 rounded-xl bg-[#0F121A] border border-gray-800 hover:border-gray-700 cursor-pointer transition flex items-center gap-3"
          >
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
              <Timer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-white">Metrônomo</h3>
              <p className="text-[10px] text-gray-400">Visual & Áudio</p>
            </div>
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
