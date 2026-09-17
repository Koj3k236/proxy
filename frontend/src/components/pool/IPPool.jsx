import { useState, useEffect, useMemo, useCallback } from "react";
import { api, errMsg } from "@/lib/api";
import { regionOf } from "@/lib/regions";
import { Button } from "@/components/ui/button";
import { Radar, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { RegionNav, ChipRow } from "@/components/pool/RegionNav";
import PoolTable from "@/components/pool/PoolTable";
import ScanDialog from "@/components/pool/ScanDialog";

export default function IPPool({ active, onActivated }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [region, setRegion] = useState("US");
  const [chip, setChip] = useState(null);
  const [filters, setFilters] = useState({});
  const [scanOpen, setScanOpen] = useState(false);
  const [activatingId, setActivatingId] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/pool");
      setRows(data || []);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setChip(null); }, [region]);

  const regionCounts = useMemo(() => {
    const c = {};
    rows.forEach((r) => { const k = regionOf(r.country); c[k] = (c[k] || 0) + 1; });
    return c;
  }, [rows]);

  const inRegion = useMemo(() => rows.filter((r) => regionOf(r.country) === region), [rows, region]);

  const chips = useMemo(() => {
    const key = region === "US" ? "state_code" : "country";
    const c = {};
    inRegion.forEach((r) => { const k = r[key] || "UN"; c[k] = (c[k] || 0) + 1; });
    return Object.keys(c).sort().map((code) => ({ code, count: c[code] }));
  }, [inRegion, region]);

  const visible = useMemo(() => {
    const key = region === "US" ? "state_code" : "country";
    return inRegion.filter((r) => {
      if (chip && (r[key] || "UN") !== chip) return false;
      if (filters.kind && r.kind !== filters.kind) return false;
      return ["ip", "domain", "state_code", "city", "isp", "zip"].every((k) => {
        const f = (filters[k] || "").trim().toLowerCase();
        if (!f) return true;
        const v = k === "state_code" ? `${r.state_code || ""} ${r.state || ""}` : String(r[k] || "");
        return v.toLowerCase().includes(f);
      });
    });
  }, [inRegion, chip, filters, region]);

  const setFilter = (k, v) => setFilters((f) => ({ ...f, [k]: v }));

  const use = async (r) => {
    setActivatingId(r.id);
    try {
      await api.post("/proxy/activate", r);
      toast.success(`Proxy ${r.ip} diaktifkan sebagai gateway`);
      onActivated && onActivated(r);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setActivatingId(null);
    }
  };

  const clearPool = async () => {
    try {
      await api.delete("/pool");
      setRows([]);
      toast.success("IP pool dikosongkan");
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <div className="card-panel flex flex-col" data-testid="ip-pool">
      <div className="p-5 pb-3 border-b border-line flex items-center justify-between flex-wrap gap-3">
        <div>
          <span className="overline">Step 1 · Ambil & Filter</span>
          <h3 className="font-heading text-lg tracking-tight">IP Pool FloppyData</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-dim" data-testid="pool-count">{rows.length} IP</span>
          {rows.length > 0 && (
            <Button onClick={clearPool} variant="outline" size="sm" className="rounded-none border-line hover:border-signal hover:text-signal font-mono text-xs h-8" data-testid="pool-clear-btn">
              <Trash2 size={13} /> Clear
            </Button>
          )}
          <Button onClick={() => setScanOpen(true)} size="sm" className="rounded-none bg-neon text-black hover:bg-neon/85 font-mono text-xs h-8" data-testid="pool-scan-btn">
            <Radar size={13} /> Scan IP
          </Button>
        </div>
      </div>

      <div className="flex gap-4 p-4 border-b border-line">
        <RegionNav counts={regionCounts} value={region} onChange={setRegion} />
        <div className="flex-1 min-w-0 pt-1">
          <ChipRow chips={chips} value={chip} onChange={setChip} />
        </div>
      </div>

      <div className="overflow-auto max-h-[520px]">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-dim gap-2 font-mono text-sm">
            <Loader2 className="animate-spin" size={16} /> memuat pool...
          </div>
        ) : (
          <PoolTable rows={visible} filters={filters} setFilter={setFilter} activeIp={active?.exit_ip} activatingId={activatingId} onUse={use} />
        )}
      </div>

      <ScanDialog open={scanOpen} onOpenChange={setScanOpen} onScanned={load} />
    </div>
  );
}
