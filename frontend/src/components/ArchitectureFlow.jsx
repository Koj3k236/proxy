import { countryFlag } from "@/lib/api";
import { Cloud, ListTree, Server, Globe, ChevronRight } from "lucide-react";

function Node({ icon: Icon, label, sub, active, accent }) {
  return (
    <div
      className={`relative flex flex-col items-center text-center gap-2 px-3 py-4 min-w-[118px] border transition-colors duration-150 ${
        active ? "border-neon bg-neon/5 neon-glow" : accent ? "border-laser/40 bg-laser/5" : "border-line bg-black/40"
      }`}
    >
      <Icon size={20} className={active ? "text-neon" : accent ? "text-laser" : "text-dim"} />
      <span className="overline !text-[9px]">{label}</span>
      <span className={`font-mono text-xs ${active ? "text-neon" : "text-foreground"}`}>{sub}</span>
    </div>
  );
}

function Arrow() {
  return <ChevronRight className="text-line shrink-0" size={22} />;
}

export default function ArchitectureFlow({ active }) {
  return (
    <div className="card-panel h-full p-5 grid-lines relative overflow-hidden" data-testid="architecture-flow">
      <div className="flex items-center justify-between mb-4">
        <div>
          <span className="overline">Pipeline</span>
          <h3 className="font-heading text-lg tracking-tight">Alur Proxy Gateway</h3>
        </div>
        <span className="font-mono text-[10px] text-dim">FLOPPYDATA → WEB KAMU</span>
      </div>
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        <Node icon={Cloud} label="Sumber" sub="FloppyData" />
        <Arrow />
        <Node icon={ListTree} label="Daftar Proxy" sub="Locations" />
        <Arrow />
        <Node
          icon={Globe}
          label="Proxy Dipilih"
          sub={active ? `${countryFlag(active.country)} ${active.exit_ip || active.country || "—"}` : "belum dipilih"}
          active={!!active}
        />
        <Arrow />
        <Node icon={Server} label="Proxy Server" sub=":8080" accent />
        <Arrow />
        <Node icon={Globe} label="Web Kamu" sub="output" />
      </div>
      <p className="mt-3 text-xs text-dim font-mono">
        {active
          ? `Traffic diteruskan lewat ${active.type} · ${active.host}:${active.port}`
          : "Pilih satu proxy dari daftar untuk mengaktifkan gateway."}
      </p>
    </div>
  );
}
