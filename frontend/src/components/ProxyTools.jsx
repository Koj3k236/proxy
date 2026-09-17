import { useState } from "react";
import { api, errMsg } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Activity, Globe2, Loader2, TerminalSquare } from "lucide-react";
import { toast } from "sonner";

export default function ProxyTools({ active, gateway }) {
  const [url, setUrl] = useState("https://api.ipify.org?format=json");
  const [lines, setLines] = useState([{ t: "info", m: "$ gateway siap. pilih proxy lalu jalankan test / fetch." }]);
  const [testing, setTesting] = useState(false);
  const [fetching, setFetching] = useState(false);

  const push = (arr) => setLines((prev) => [...prev, ...arr].slice(-40));

  const runTest = async () => {
    if (!active) return toast.error("Belum ada proxy aktif");
    setTesting(true);
    push([{ t: "cmd", m: "$ health-check proxy aktif..." }]);
    try {
      const { data } = await api.post("/proxy/test", {});
      if (data.status === "alive") {
        push([
          { t: "ok", m: `[ALIVE] latency ${data.latency_ms}ms · http ${data.http_status}` },
          { t: "out", m: `exit_ip = ${data.exit_ip}` },
        ]);
      } else {
        push([{ t: "err", m: `[DEAD] ${data.error || "tidak merespon"} (${data.latency_ms}ms)` }]);
      }
    } catch (e) {
      push([{ t: "err", m: errMsg(e) }]);
    } finally {
      setTesting(false);
    }
  };

  const runFetch = async () => {
    if (!active) return toast.error("Belum ada proxy aktif");
    if (!url.trim()) return;
    setFetching(true);
    push([{ t: "cmd", m: `$ curl --proxy [gateway] ${url}` }]);
    try {
      const { data } = await api.post("/proxy/fetch", { url });
      push([
        { t: "ok", m: `HTTP ${data.http_status} · ${data.latency_ms}ms · ${data.content_length}b · ${data.content_type || ""}` },
        { t: "out", m: `via exit_ip ${data.via_proxy?.exit_ip} (${data.via_proxy?.country || "?"})` },
        ...(data.title ? [{ t: "out", m: `title: ${data.title}` }] : []),
        { t: "body", m: data.body_preview?.slice(0, 800) || "" },
      ]);
      toast.success(`Fetched ${data.http_status} lewat proxy`);
    } catch (e) {
      push([{ t: "err", m: errMsg(e) }]);
      toast.error(errMsg(e));
    } finally {
      setFetching(false);
    }
  };

  const color = (t) =>
    ({ ok: "text-laser", err: "text-signal", cmd: "text-neon", out: "text-foreground", body: "text-dim", info: "text-dim" }[t] || "text-dim");

  return (
    <div className="card-panel h-full flex flex-col" data-testid="proxy-tools">
      <div className="p-5 pb-3 border-b border-line">
        <span className="overline">Step 2 · Proxy Server :{gateway?.port || "8080"}</span>
        <h3 className="font-heading text-lg tracking-tight">Test & Fetch</h3>
      </div>

      <div className="p-4 space-y-3">
        <Button
          onClick={runTest}
          disabled={testing || !active}
          variant="outline"
          className="w-full rounded-none border-line hover:border-laser hover:text-laser font-mono text-sm"
          data-testid="run-test-btn"
        >
          {testing ? <Loader2 className="animate-spin" size={15} /> : <Activity size={15} />} Health Check
        </Button>

        <div className="flex gap-2">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://target.com"
            className="bg-black border-line font-mono text-sm rounded-none focus-visible:ring-neon"
            data-testid="fetch-url-input"
          />
          <Button
            onClick={runFetch}
            disabled={fetching || !active}
            className="rounded-none bg-neon text-black hover:bg-neon/85 shrink-0"
            data-testid="run-fetch-btn"
          >
            {fetching ? <Loader2 className="animate-spin" size={15} /> : <Globe2 size={15} />}
          </Button>
        </div>
      </div>

      <div className="flex-1 mx-4 mb-4 bg-black border border-line overflow-auto max-h-[240px]" data-testid="terminal-output">
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-line text-dim">
          <TerminalSquare size={13} />
          <span className="font-mono text-[10px] tracking-widest uppercase">output</span>
        </div>
        <div className="p-3 font-mono text-xs space-y-1 whitespace-pre-wrap break-all">
          {lines.map((l, i) => (
            <div key={i} className={color(l.t)}>
              {l.m}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
