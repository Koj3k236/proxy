import { useState, useEffect } from "react";
import { api, countryFlag, errMsg } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Zap, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

const ROTATIONS = [
  { v: 0, label: "Sticky (no rotation)" },
  { v: 1, label: "1 menit" },
  { v: 10, label: "10 menit" },
  { v: 15, label: "15 menit" },
  { v: 30, label: "30 menit" },
];

export default function BuildDialog({ location, onClose, onActivated }) {
  const open = !!location;
  const [city, setCity] = useState("any");
  const [rotation, setRotation] = useState("15");
  const [protocol, setProtocol] = useState("http");
  const [building, setBuilding] = useState(false);
  const [activating, setActivating] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (location) {
      setCity("any");
      setRotation("15");
      setProtocol("http");
      setResult(null);
    }
  }, [location]);

  const build = async () => {
    setBuilding(true);
    setResult(null);
    try {
      const body = {
        type: location.type,
        country: location.countryCode,
        protocol,
        rotation: parseInt(rotation, 10),
      };
      if (city && city !== "any") body.city = city;
      const { data } = await api.post("/proxy/build", body);
      setResult(data);
      if (data.status === "alive") toast.success(`Proxy hidup · exit IP ${data.exit_ip}`);
      else toast.warning("Proxy dibuat, tapi tes koneksi gagal");
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBuilding(false);
    }
  };

  const activate = async () => {
    if (!result) return;
    setActivating(true);
    try {
      await api.post("/proxy/activate", result);
      toast.success("Proxy diaktifkan sebagai gateway");
      onActivated && onActivated(result);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setActivating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-panel border-line text-foreground max-w-lg" data-testid="build-dialog">
        <DialogHeader>
          <DialogTitle className="font-heading tracking-tight flex items-center gap-2">
            {location && <span className="text-2xl">{countryFlag(location.countryCode)}</span>}
            Konfigurasi Proxy · {location?.name}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <span className="overline">Type</span>
            <div className="font-mono text-sm border border-line bg-black px-3 py-2 uppercase text-neon">{location?.type}</div>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="overline">City</span>
            <Select value={city} onValueChange={setCity}>
              <SelectTrigger className="rounded-none bg-black border-line font-mono text-sm" data-testid="build-city">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-panel border-line">
                <SelectItem value="any" className="font-mono">Any city</SelectItem>
                {location?.cities?.map((c) => (
                  <SelectItem key={c} value={c} className="font-mono">{c.replace(/_/g, " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="overline">Rotation</span>
            <Select value={rotation} onValueChange={setRotation}>
              <SelectTrigger className="rounded-none bg-black border-line font-mono text-sm" data-testid="build-rotation">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-panel border-line">
                {ROTATIONS.map((r) => (
                  <SelectItem key={r.v} value={String(r.v)} className="font-mono">{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="overline">Protocol</span>
            <Select value={protocol} onValueChange={setProtocol}>
              <SelectTrigger className="rounded-none bg-black border-line font-mono text-sm" data-testid="build-protocol">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-panel border-line">
                <SelectItem value="http" className="font-mono">HTTP</SelectItem>
                <SelectItem value="https" className="font-mono">HTTPS</SelectItem>
                <SelectItem value="socks5" className="font-mono" data-testid="build-protocol-socks5">SOCKS5</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {result && (
          <div className="card-panel bg-black p-3 space-y-2 font-mono text-xs" data-testid="build-result">
            <div className="flex items-center gap-2">
              {result.status === "alive" ? (
                <span className="text-laser flex items-center gap-1"><CheckCircle2 size={14} /> ALIVE</span>
              ) : (
                <span className="text-signal flex items-center gap-1"><XCircle size={14} /> DEAD</span>
              )}
              <span className="text-dim">· {result.latency_ms} ms</span>
            </div>
            <div className="text-dim">exit_ip: <span className="text-neon">{result.exit_ip || "—"}</span></div>
            <div className="text-dim break-all">endpoint: <span className="text-neon uppercase">{result.protocol}</span> {result.host}:{result.port}</div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button
            onClick={build}
            disabled={building}
            variant="outline"
            className="rounded-none border-line hover:border-neon hover:text-neon"
            data-testid="build-btn"
          >
            {building ? <Loader2 className="animate-spin" size={15} /> : <Zap size={15} />} Build & Test
          </Button>
          <Button
            onClick={activate}
            disabled={!result || activating}
            className="rounded-none bg-neon text-black hover:bg-neon/85 font-medium"
            data-testid="activate-btn"
          >
            {activating ? <Loader2 className="animate-spin" size={15} /> : null} Aktifkan Gateway
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
