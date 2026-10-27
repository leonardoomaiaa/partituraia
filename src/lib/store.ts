import type { InstrumentId } from "./transpose";
import { canSaveSong, type PlanId } from "./billing";

export type Session = { notes: string[]; from: InstrumentId; to: InstrumentId };
export type HistoryItem = {
  id: number;
  original: string[];
  result: string[];
  from: InstrumentId;
  to: InstrumentId;
  ts: number;
  folder: string;
};
export type NewHistory = { original: string[]; result: string[]; from: InstrumentId; to: InstrumentId; folder?: string };

const HISTORY_KEY = "octava-history";
const SESSION_KEY = "octava-session";
const FOLDERS_KEY = "octava-folders";
export const DEFAULT_FOLDER = "Geral";
/** Teto técnico do armazenamento local; o limite do plano gratuito é outro (ver billing). */
const STORAGE_CEILING = 500;

const read = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

const write = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* armazenamento indisponível */
  }
};

const notify = () => window.dispatchEvent(new Event("octava-history"));

export function getSession(): Session {
  return read<Session>(SESSION_KEY, { notes: [], from: "c", to: "c" });
}
export function setSession(s: Session) {
  write(SESSION_KEY, s);
}

export function getHistory(): HistoryItem[] {
  return read<HistoryItem[]>(HISTORY_KEY, []);
}

/** Salva a música, respeitando o limite do plano gratuito. */
export function addHistory(item: NewHistory, plan: PlanId): { ok: boolean; reason?: "limit" } {
  const list = getHistory();
  if (!canSaveSong(plan, list.length)) return { ok: false, reason: "limit" };
  const next: HistoryItem[] = [
    {
      id: Date.now() + Math.floor(Math.random() * 1000),
      original: item.original,
      result: item.result,
      from: item.from,
      to: item.to,
      ts: Date.now(),
      folder: item.folder?.trim() || DEFAULT_FOLDER,
    },
    ...list,
  ].slice(0, STORAGE_CEILING);
  write(HISTORY_KEY, next);
  notify();
  return { ok: true };
}

export function removeHistory(id: number) {
  write(HISTORY_KEY, getHistory().filter((h) => h.id !== id));
  notify();
}

export function moveHistory(id: number, folder: string) {
  write(
    HISTORY_KEY,
    getHistory().map((h) => (h.id === id ? { ...h, folder } : h)),
  );
  notify();
}

export function getFolders(): string[] {
  const folders = read<string[]>(FOLDERS_KEY, [DEFAULT_FOLDER]);
  return folders.length ? folders : [DEFAULT_FOLDER];
}

export function addFolder(name: string): { ok: boolean; reason?: "exists" | "empty" } {
  const clean = name.trim();
  if (!clean) return { ok: false, reason: "empty" };
  const folders = getFolders();
  if (folders.some((f) => f.toLowerCase() === clean.toLowerCase())) return { ok: false, reason: "exists" };
  write(FOLDERS_KEY, [...folders, clean]);
  notify();
  return { ok: true };
}

/** Remove a pasta e devolve as músicas dela para a pasta padrão. */
export function removeFolder(name: string) {
  if (name === DEFAULT_FOLDER) return;
  const folders = getFolders().filter((f) => f !== name);
  write(FOLDERS_KEY, folders.length ? folders : [DEFAULT_FOLDER]);
  write(
    HISTORY_KEY,
    getHistory().map((h) => (h.folder === name ? { ...h, folder: DEFAULT_FOLDER } : h)),
  );
  notify();
}

export function relativeTime(ts: number) {
  const diff = Math.max(0, Date.now() - ts);
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `há ${days} d`;
  return new Date(ts).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}
