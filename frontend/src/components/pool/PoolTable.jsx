import { countryFlag } from "@/lib/api";
import { addedLabel } from "@/lib/regions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Router, Smartphone, Server, Loader2, Play } from "lucide-react";

const COLS = [
  { k: "ip", label: "IP", w: "w-[215px]" },
  { k: "domain", label: "Domain", w: "w-[185px]" },
  { k: "state_code", label: "State", w: "w-[90px]" },
  { k: "city", label: "City", w: "w-[150px]" },
  { k: "isp", label: "ISP", w: "" },
  { k: "zip", label: "ZIP", w: "w-[85px]" },
];

const KIND_ICON = { ISP: Router, "ISP/MOB": Smartphone, DC: Server };

function KindBadge({ kind }) {
  const Icon = KIND_ICON[kind] || Router;
  return (
    <span className="inline-flex items-center gap-1 font-mono text-xs text-dim">
      <Icon size={12} /> {kind}
    </span>
  );
}

function pingClass(ms) {
  if (ms == null) return "text-dim";
  if (ms < 500) return "text-laser";
  if (ms < 900) return "text-foreground";
  return "text-signal";
}

export default function PoolTable({ rows, filters, setFilter, activeIp, activatingId, onUse }) {
  const inp = "h-8 bg-black border-line font-mono text-xs rounded-none focus-visible:ring-neon";
  return (
    <Table className="table-fixed">
      <TableHeader className="sticky top-0 bg-panel z-10">
        <TableRow className="border-line hover:bg-transparent">
          {COLS.map((c) => <TableHead key={c.k} className={`overline !text-neon ${c.w}`}>{c.label}</TableHead>)}
          <TableHead className="overline !text-neon w-[80px]">Ping</TableHead>
          <TableHead className="overline !text-neon w-[100px]">Type</TableHead>
          <TableHead className="overline !text-neon w-[90px]">Added</TableHead>
          <TableHead className="w-[70px]" />
        </TableRow>
        <TableRow className="border-line hover:bg-transparent">
          {COLS.map((c) => (
            <TableHead key={c.k} className="py-1.5">
              <Input value={filters[c.k] || ""} onChange={(e) => setFilter(c.k, e.target.value)} placeholder={c.k === "state_code" ? "ST" : c.label.toUpperCase()} className={inp} data-testid={`filter-${c.k}`} />
            </TableHead>
          ))}
          <TableHead />
          <TableHead className="py-1.5">
            <Select value={filters.kind || "any"} onValueChange={(v) => setFilter("kind", v === "any" ? "" : v)}>
              <SelectTrigger className={`${inp} px-2`} data-testid="filter-kind"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-panel border-line">
                <SelectItem value="any" className="font-mono text-xs">Any</SelectItem>
                <SelectItem value="ISP" className="font-mono text-xs">ISP</SelectItem>
                <SelectItem value="ISP/MOB" className="font-mono text-xs">ISP/MOB</SelectItem>
                <SelectItem value="DC" className="font-mono text-xs">DC</SelectItem>
              </SelectContent>
            </Select>
          </TableHead>
          <TableHead colSpan={2} />
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r, idx) => {
          const isActive = activeIp === r.ip;
          return (
            <TableRow
              key={r.id}
              className={`border-line hover:bg-neon/5 animate-fade-up ${isActive ? "bg-neon/10" : ""}`}
              style={{ animationDelay: `${Math.min(idx, 20) * 12}ms` }}
              data-testid={`pool-row-${r.ip}`}
            >
              <TableCell className="font-mono text-sm truncate">
                <span className="mr-1.5">{countryFlag(r.country)}</span>
                <span className={isActive ? "text-neon" : "text-foreground"}>{r.ip}</span>
                <span className="text-dim">:{r.port}</span>
              </TableCell>
              <TableCell className="font-mono text-xs text-dim truncate" title={r.domain || ""}>{r.domain || "—"}</TableCell>
              <TableCell className="font-mono text-xs">{r.state_code || "—"}</TableCell>
              <TableCell className="text-sm truncate">{r.city || "—"}</TableCell>
              <TableCell className="text-sm truncate" title={r.isp || ""}>{r.isp || "—"}</TableCell>
              <TableCell className="font-mono text-xs text-dim">{r.zip || "—"}</TableCell>
              <TableCell className={`font-mono text-xs ${pingClass(r.latency_ms)}`}>{r.latency_ms != null ? r.latency_ms : "—"}</TableCell>
              <TableCell><KindBadge kind={r.kind} /></TableCell>
              <TableCell className="font-mono text-xs text-dim">{addedLabel(r.added_at)}</TableCell>
              <TableCell className="text-right">
                <Button
                  size="sm"
                  variant={isActive ? "default" : "outline"}
                  disabled={activatingId === r.id}
                  onClick={() => onUse(r)}
                  className={`rounded-none font-mono text-[10px] h-6 px-2 ${isActive ? "bg-neon text-black hover:bg-neon" : "border-line hover:border-neon hover:text-neon"}`}
                  data-testid={`use-${r.ip}`}
                >
                  {activatingId === r.id ? <Loader2 size={11} className="animate-spin" /> : isActive ? "ACTIVE" : <><Play size={10} /> USE</>}
                </Button>
              </TableCell>
            </TableRow>
          );
        })}
        {rows.length === 0 && (
          <TableRow>
            <TableCell colSpan={10} className="text-center text-dim py-10 font-mono text-sm">
              tidak ada IP · ubah filter atau jalankan Scan
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
