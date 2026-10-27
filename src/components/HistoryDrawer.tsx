import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, FolderPlus, History, RotateCcw, Trash2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  DEFAULT_FOLDER,
  addFolder,
  getFolders,
  getHistory,
  moveHistory,
  relativeTime,
  removeFolder,
  removeHistory,
  setSession,
  type HistoryItem,
} from "@/lib/store";
import { getInstrument } from "@/lib/transpose";
import { ProBadge } from "@/components/ProBadge";

export function useHistory() {
  const [list, setList] = useState<HistoryItem[]>([]);
  useEffect(() => {
    const load = () => setList(getHistory());
    load();
    window.addEventListener("octava-history", load);
    return () => window.removeEventListener("octava-history", load);
  }, []);
  return list;
}

export function HistoryDrawer({ children }: { children: ReactNode }) {
  const list = useHistory();
  const [open, setOpen] = useState(false);
  const [folder, setFolder] = useState<string>("Todas");
  const [folders, setFolders] = useState<string[]>(getFolders());
  const [newFolder, setNewFolder] = useState("");
  const [showInput, setShowInput] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const load = () => setFolders(getFolders());
    load();
    window.addEventListener("octava-history", load);
    return () => window.removeEventListener("octava-history", load);
  }, []);

  const visible = folder === "Todas" ? list : list.filter((h) => h.folder === folder);

  const createFolder = () => {
    const result = addFolder(newFolder);
    if (!result.ok) return;
    setNewFolder("");
    setShowInput(false);
    setFolders(getFolders());
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent
        side="bottom"
        className="max-h-[85vh] rounded-t-3xl border-border/60 bg-card/95 backdrop-blur-xl"
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-left">
            <History className="h-5 w-5 text-primary" /> Histórico
            <ProBadge />
          </SheetTitle>
        </SheetHeader>

        <div className="mt-3 flex flex-wrap items-center gap-1.5 px-4">
          {["Todas", ...folders].map((f) => (
            <button
              key={f}
              onClick={() => setFolder(f)}
              className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition active:scale-95 ${
                folder === f ? "border-primary/50 bg-primary/15 text-primary" : "border-border text-muted-foreground"
              }`}
            >
              {f}
            </button>
          ))}
          <button
            onClick={() => setShowInput((v) => !v)}
            aria-label="Nova pasta"
            className="rounded-lg border border-dashed border-border px-2 py-1 text-muted-foreground transition active:scale-95"
          >
            <FolderPlus className="h-3.5 w-3.5" />
          </button>
        </div>

        {showInput && (
          <div className="mt-2 flex gap-2 px-4">
            <input
              value={newFolder}
              onChange={(e) => setNewFolder(e.target.value)}
              placeholder="Nome da pasta"
              className="flex-1 rounded-xl border border-input bg-secondary/50 px-3 py-2 text-sm outline-none focus:border-primary/60"
            />
            <button
              onClick={createFolder}
              className="rounded-xl bg-gold px-3 py-2 text-xs font-semibold text-primary-foreground transition active:scale-95"
            >
              Criar
            </button>
          </div>
        )}

        <div className="mt-2 overflow-y-auto px-4 pb-6">
          {visible.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {list.length === 0
                ? "Nenhuma transposição salva ainda."
                : "Nenhuma música nesta pasta."}
            </p>
          ) : (
            <ul className="space-y-2">
              {visible.map((h) => (
                <li key={h.id} className="rounded-2xl border border-border/60 bg-secondary/50 p-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1 font-medium">
                      {getInstrument(h.from).key} <ArrowRight className="h-3 w-3" /> {getInstrument(h.to).key}
                      <span className="ml-1 font-normal">· {getInstrument(h.to).short}</span>
                    </span>
                    <span>{relativeTime(h.ts)}</span>
                  </div>
                  <div className="mt-1.5 truncate text-sm">
                    <span className="text-muted-foreground">{h.original.join(" ")}</span>
                    <span className="mx-1.5 text-muted-foreground">→</span>
                    <span className="font-semibold text-success">{h.result.join(" ")}</span>
                  </div>
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <select
                      value={h.folder}
                      onChange={(e) => moveHistory(h.id, e.target.value)}
                      className="rounded-lg border border-border bg-card px-2 py-1.5 text-xs font-medium outline-none focus:border-primary/60"
                    >
                      {folders.map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => {
                        setSession({ notes: h.original, from: h.from, to: h.to });
                        setOpen(false);
                        navigate({ to: "/teclado" });
                      }}
                      className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold transition active:scale-95"
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> Reutilizar
                    </button>
                    <button
                      onClick={() => removeHistory(h.id)}
                      aria-label="Excluir"
                      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-destructive transition active:scale-95"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Excluir
                    </button>
                    {h.folder !== DEFAULT_FOLDER && (
                      <button
                        onClick={() => removeFolder(h.folder)}
                        className="ml-auto text-[11px] text-muted-foreground underline-offset-4 hover:underline"
                      >
                        excluir pasta
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
