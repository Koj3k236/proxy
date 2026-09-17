import { useEffect, useState, useCallback } from "react";
import { api, errMsg } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Flag, Loader2, Square } from "lucide-react";
import { toast } from "sonner";

export default function BulkScan({ onProgress }) {
  const [job, setJob] = useState(null);
  const [starting, setStarting] = useState(false);

  const poll = useCallback(async () => {
    try {
      const { data } = await api.get("/pool/scan-bulk/status");
      setJob(data);
      return data;
    } catch (e) {
      return null;
    }
  }, []);

  useEffect(() => { poll(); }, [poll]);

  useEffect(() => {
    if (!job?.running) return;
    const t = setInterval(async () => {
      const d = await poll();
      onProgress && onProgress();
      if (d && !d.running) toast.success(`Scan USA selesai · ${d.found} IP ditemukan, ${d.new} baru`);
    }, 3000);
    return () => clearInterval(t);
  }, [job?.running, poll, onProgress]);

  const start = async () => {
    setStarting(true);
    try {
      const { data } = await api.post("/pool/scan-bulk", { country: "US", per_state: 20 });
      setJob(data);
      toast.success(`Scan massal USA dimulai · ${data.total} state`);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setStarting(false);
    }
  };

  const stop = async () => {
    try {
      const { data } = await api.post("/pool/scan-bulk/stop");
      setJob(data);
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const running = !!job?.running;
  const pct = job?.total ? Math.round((job.done / job.total) * 100) : 0;

  return (
    <>
      <Button
        onClick={running ? stop : start}
        disabled={starting}
        variant="outline"
        size="sm"
        className={`rounded-none font-mono text-xs h-8 ${running ? "border-signal text-signal hover:bg-signal/10" : "border-line hover:border-laser hover:text-laser"}`}
        data-testid="pool-bulk-btn"
      >
        {running ? <Square size={12} /> : starting ? <Loader2 size={13} className="animate-spin" /> : <Flag size={13} />}
        {running ? "Stop" : "Scan USA"}
      </Button>
      {running && (
        <div className="w-full basis-full" data-testid="bulk-progress">
          <div className="flex items-center justify-between font-mono text-[11px] text-dim mb-1">
            <span>
              scan massal US · state <span className="text-foreground">{job.done}/{job.total}</span>
              {job.current && <> · <span className="text-neon">{job.current}</span></>}
            </span>
            <span><span className="text-laser">{job.found}</span> IP · {job.new} baru</span>
          </div>
          <div className="h-1 bg-black border border-line">
            <div className="h-full bg-laser laser-glow transition-[width] duration-500" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}
    </>
  );
}
