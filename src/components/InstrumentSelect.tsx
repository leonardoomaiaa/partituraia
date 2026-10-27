import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { INSTRUMENTS, getInstrument, type InstrumentId } from "@/lib/transpose";

export function InstrumentSelect({ label, value, onChange }: { label: string; value: InstrumentId; onChange: (v: InstrumentId) => void }) {
  const i = getInstrument(value);
  return (
    <div className="min-w-0 flex-1">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <Select value={value} onValueChange={(v) => onChange(v as InstrumentId)}>
        <SelectTrigger className="h-auto w-full rounded-xl border-border/70 bg-secondary/60 px-3 py-2 text-left">
          <div className="min-w-0">
            <div className="font-display text-base font-semibold text-primary">{i.tuning}</div>
            <div className="truncate text-xs text-muted-foreground">{i.short}</div>
          </div>
        </SelectTrigger>
        <SelectContent className="rounded-xl border-border bg-popover">
          {INSTRUMENTS.map((x) => (
            <SelectItem key={x.id} value={x.id} className="rounded-lg py-2">
              <span className="font-semibold">{x.tuning}</span> <span className="text-muted-foreground">· {x.label}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
