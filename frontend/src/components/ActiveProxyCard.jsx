import { useState } from "react";
import { countryFlag } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Copy, Signal, Check } from "lucide-react";

function Stat({ label, value, mono = true, className = "" }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="overline">{label}</span>
      <span className={`${mono ? "font-mono" : "font-sans"} text-sm ${className}`}>{value}</span>
    </div>
  );
}

export default function ActiveProxyCard({ active }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    if (!active?.connection_string) return;
    navigator.clipboard.writeText(active.connection_string);
    setCopied(true);
    toast.success("Connection string disalin");
    setTimeout(() => setCopied(false), 1500);
  };

  if (!active) {
    return (
      <div className="card-panel h-full p-5 flex flex-col justify-center items-center text-center gap-2 border-b-2 border-b-line" data-testid="active-proxy-empty">
        <Signal className="text-dim" size={26} />
        <span className="overline">Active Proxy</span>
        <p className="text-sm text-dim">Belum ada proxy aktif</p>
      </div>
    );
  }

  const alive = active.status === "alive";

  return (
    <div className="card-panel h-full p-5 border-b-2 border-b-neon relative overflow-hidden" data-testid="active-proxy-card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${alive ? "bg-laser laser-glow animate-pulse-dot" : "bg-signal"}`} />
          <span className="overline">Active Proxy · {active.type}</span>
        </div>
        <span className="text-2xl leading-none">{countryFlag(active.country)}</span>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <Stat label="Exit IP" value={active.exit_ip || "—"} className="text-neon text-base" />
        <Stat label="Protocol · Port" value={`${(active.protocol || "http").toUpperCase()} · ${active.port}`} />
        <Stat label="Country" value={active.country || "AUTO"} />
        <Stat label="Latency" value={active.latency_ms != null ? `${active.latency_ms} ms` : "—"} className={alive ? "text-laser" : "text-signal"} />
      </div>

      <div className="flex flex-col gap-1">
        <span className="overline">Connection String</span>
        <div className="flex items-stretch gap-2">
          <code className="flex-1 bg-black border border-line px-2 py-2 text-[11px] font-mono text-dim truncate" title={active.connection_string} data-testid="active-connection-string">
            {active.connection_string}
          </code>
          <Button
            onClick={copy}
            variant="outline"
            className="rounded-none border-line hover:border-neon hover:text-neon px-3"
            data-testid="copy-connection-btn"
          >
            {copied ? <Check size={15} className="text-laser" /> : <Copy size={15} />}
          </Button>
        </div>
      </div>
    </div>
  );
}
