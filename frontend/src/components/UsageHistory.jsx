import { countryFlag, api, errMsg } from "@/lib/api";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { History, Trash2, RotateCw } from "lucide-react";
import { toast } from "sonner";

export default function UsageHistory({ items, onChanged }) {
  const clearAll = async () => {
    try {
      await api.delete("/history");
      toast.success("Riwayat dihapus");
      onChanged && onChanged();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const reactivate = async (item) => {
    try {
      await api.post("/proxy/activate", item);
      toast.success("Proxy diaktifkan ulang");
      onChanged && onChanged();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <div className="card-panel" data-testid="usage-history">
      <div className="p-5 pb-3 border-b border-line flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History size={16} className="text-dim" />
          <div>
            <span className="overline">Step 4 · Log</span>
            <h3 className="font-heading text-lg tracking-tight">Riwayat Proxy</h3>
          </div>
        </div>
        {items.length > 0 && (
          <Button
            onClick={clearAll}
            variant="outline"
            size="sm"
            className="rounded-none border-line hover:border-signal hover:text-signal font-mono text-xs h-8"
            data-testid="clear-history-btn"
          >
            <Trash2 size={13} /> Clear
          </Button>
        )}
      </div>
      <div className="overflow-auto max-h-[300px]">
        <Table>
          <TableHeader className="sticky top-0 bg-panel">
            <TableRow className="border-line hover:bg-transparent">
              <TableHead className="overline">Country</TableHead>
              <TableHead className="overline">Type</TableHead>
              <TableHead className="overline">Exit IP</TableHead>
              <TableHead className="overline">Latency</TableHead>
              <TableHead className="overline">Status</TableHead>
              <TableHead className="overline">Used</TableHead>
              <TableHead className="overline text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((it) => (
              <TableRow key={it.id} className="border-line hover:bg-white/[0.02]" data-testid={`history-row-${it.id}`}>
                <TableCell className="font-sans">
                  <span className="mr-2">{countryFlag(it.country)}</span>
                  {it.country || "AUTO"}
                </TableCell>
                <TableCell className="font-mono text-xs uppercase text-dim">{it.type}</TableCell>
                <TableCell className="font-mono text-neon text-sm">{it.exit_ip || "—"}</TableCell>
                <TableCell className="font-mono text-xs">{it.latency_ms != null ? `${it.latency_ms}ms` : "—"}</TableCell>
                <TableCell>
                  <span className={`font-mono text-[10px] uppercase border px-1.5 py-0.5 ${it.status === "alive" ? "border-laser text-laser" : "border-signal text-signal"}`}>
                    {it.status || "?"}
                  </span>
                </TableCell>
                <TableCell className="font-mono text-[11px] text-dim">
                  {it.used_at ? new Date(it.used_at).toLocaleString() : "—"}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    onClick={() => reactivate(it)}
                    variant="ghost"
                    size="sm"
                    className="rounded-none hover:text-neon h-7 font-mono text-xs"
                    data-testid={`reactivate-${it.id}`}
                  >
                    <RotateCw size={13} />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {items.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-dim py-8 font-mono text-sm">
                  belum ada riwayat
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
