import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { api, errMsg } from "@/lib/api";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";

export default function SettingsDialog({ open, onOpenChange, onSaved }) {
  const [status, setStatus] = useState(null);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const { data } = await api.get("/settings");
      setStatus(data);
    } catch (e) {
      /* ignore */
    }
  };

  useEffect(() => {
    if (open) load();
  }, [open]);

  const save = async () => {
    if (!value.trim()) return;
    setSaving(true);
    try {
      await api.post("/settings", { api_key: value.trim() });
      toast.success("API key tersimpan");
      setValue("");
      await load();
      onSaved && onSaved();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-panel border-line text-foreground max-w-md" data-testid="settings-dialog">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2 tracking-tight">
            <KeyRound size={18} className="text-neon" /> FloppyData API Key
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="text-sm text-dim">
            Key dipakai di header <span className="font-mono text-neon">X-Api-Key</span> untuk mengambil daftar proxy dari FloppyData.
          </div>
          <div className="card-panel p-3 flex items-center justify-between">
            <span className="overline">Status</span>
            {status?.configured ? (
              <span className="font-mono text-sm text-laser" data-testid="settings-status">
                {status.api_key_masked} · {status.source}
              </span>
            ) : (
              <span className="font-mono text-sm text-signal">belum diatur</span>
            )}
          </div>
          <Input
            data-testid="settings-apikey-input"
            placeholder="Tempel API key baru..."
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="font-mono bg-black border-line focus-visible:ring-neon"
          />
          <div className="flex justify-end gap-2">
            <Button
              onClick={save}
              disabled={saving || !value.trim()}
              className="bg-neon text-black hover:bg-neon/85 rounded-none font-medium"
              data-testid="settings-save-btn"
            >
              {saving ? "Menyimpan..." : "Simpan Key"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function SettingsTrigger({ children }) {
  return <DialogTrigger asChild>{children}</DialogTrigger>;
}
