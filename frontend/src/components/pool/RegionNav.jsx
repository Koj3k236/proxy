import { REGIONS } from "@/lib/regions";

export function RegionNav({ counts, value, onChange }) {
  return (
    <div className="flex flex-col gap-0.5 min-w-[150px]" data-testid="region-nav">
      {REGIONS.map((r) => {
        const active = value === r.id;
        return (
          <button
            key={r.id}
            onClick={() => onChange(r.id)}
            className={`flex items-center justify-between px-3 py-1.5 text-sm transition-colors duration-150 ${
              active ? "bg-neon text-black font-medium" : "text-neon/80 hover:bg-neon/10"
            }`}
            data-testid={`region-${r.id}`}
          >
            <span>{r.label}</span>
            <span className={`font-mono text-xs italic ${active ? "text-black/70" : "text-dim"}`}>{counts[r.id] || 0}</span>
          </button>
        );
      })}
    </div>
  );
}

export function ChipRow({ chips, value, onChange }) {
  if (!chips.length) {
    return <p className="text-xs text-dim font-mono py-2">belum ada IP untuk wilayah ini · klik Scan</p>;
  }
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-1.5" data-testid="chip-row">
      {chips.map((c) => {
        const active = value === c.code;
        return (
          <button
            key={c.code}
            onClick={() => onChange(active ? null : c.code)}
            className={`font-mono text-sm transition-colors duration-150 ${
              active ? "text-neon underline underline-offset-4" : "text-dim hover:text-foreground"
            }`}
            data-testid={`chip-${c.code}`}
          >
            {c.code} - {c.count}
          </button>
        );
      })}
    </div>
  );
}
