import { useState, useEffect } from "react";
import { api, countryFlag, errMsg } from "@/lib/api";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Radar } from "lucide-react";
import { toast } from "sonner";

const TYPES = ["residential", "mobile", "datacenter"];

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="overline">{label}</span>
      {children}
    </div>
  );
}

const trigger = "rounded-none bg-black border-line font-mono text-sm";

export default function ScanDialog({ open, onOpenChange, onScanned }) {
  const [type, setType] = useState("residential");
  const [locations, setLocations] = useState([]);
  const [country, setCountry] = useState("US");
  const [state, setState] = useState("any");
  const [city, setCity] = useState("any");
  const [protocol, setProtocol] = useState("http");
  const [count, setCount] = useState("20");
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    if (!open) return;
    api.get("/locations", { params: { type } })
      .then(({ data }) => setLocations(data.items || []))
      .catch((e) => toast.error(errMsg(e)));
  }, [type, open]);

  useEffect(() => { setState("any"); setCity("any"); }, [country, type]);

  const loc = locations.find((l) => l.countryCode === country);

  const scan = async () => {
    setScanning(true);
    try {
      const body = { type, country, protocol, count: parseInt(count, 10) };
      if (state !== "any") body.state = state;
      if (city !== "any") body.city = city;
      const { data } = await api.post("/pool/scan", body);
      toast.success(`Scan selesai · ${data.alive} IP hidup, ${data.new} baru`);
      onScanned && onScanned(data);
      onOpenChange(false);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setScanning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !scanning && onOpenChange(o)}>
      <DialogContent className="bg-panel border-line text-foreground max-w-lg" data-testid="scan-dialog">
        <DialogHeader>
          <DialogTitle className="font-heading tracking-tight flex items-center gap-2">
            <Radar size={18} className="text-neon" /> Scan IP Pool
          </DialogTitle>
          <DialogDescription className="text-dim text-xs">
            Mengambil IP nyata dari FloppyData untuk lokasi terpilih, lalu ditampilkan di tabel.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className={trigger} data-testid="scan-type"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-panel border-line">
                {TYPES.map((t) => <SelectItem key={t} value={t} className="font-mono uppercase">{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Country">
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger className={trigger} data-testid="scan-country"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-panel border-line max-h-72">
                {locations.map((l) => (
                  <SelectItem key={l.countryCode} value={l.countryCode} className="font-mono">
                    {countryFlag(l.countryCode)} {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="State">
            <Select value={state} onValueChange={setState} disabled={!loc?.states?.length}>
              <SelectTrigger className={trigger} data-testid="scan-state"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-panel border-line max-h-72">
                <SelectItem value="any" className="font-mono">Any state</SelectItem>
                {loc?.states?.map((s) => <SelectItem key={s} value={s} className="font-mono">{s.replace(/_/g, " ")}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="City">
            <Select value={city} onValueChange={setCity} disabled={!loc?.cities?.length}>
              <SelectTrigger className={trigger} data-testid="scan-city"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-panel border-line max-h-72">
                <SelectItem value="any" className="font-mono">Any city</SelectItem>
                {loc?.cities?.map((c) => <SelectItem key={c} value={c} className="font-mono">{c.replace(/_/g, " ")}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Protocol">
            <Select value={protocol} onValueChange={setProtocol}>
              <SelectTrigger className={trigger} data-testid="scan-protocol"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-panel border-line">
                <SelectItem value="http" className="font-mono">HTTP</SelectItem>
                <SelectItem value="socks5" className="font-mono">SOCKS5</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Jumlah IP">
            <Select value={count} onValueChange={setCount}>
              <SelectTrigger className={trigger} data-testid="scan-count"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-panel border-line">
                {["10", "20", "50"].map((n) => <SelectItem key={n} value={n} className="font-mono">{n} IP</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <div className="flex justify-end pt-1">
          <Button
            onClick={scan}
            disabled={scanning || !country}
            className="rounded-none bg-neon text-black hover:bg-neon/85 font-medium"
            data-testid="scan-start-btn"
          >
            {scanning ? <Loader2 className="animate-spin" size={15} /> : <Radar size={15} />}
            {scanning ? "Scanning..." : "Mulai Scan"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
