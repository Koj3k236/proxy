import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import Sidebar from "@/components/Sidebar";
import SettingsDialog from "@/components/SettingsDialog";
import ArchitectureFlow from "@/components/ArchitectureFlow";
import ActiveProxyCard from "@/components/ActiveProxyCard";
import IPPool from "@/components/pool/IPPool";
import ProxyTools from "@/components/ProxyTools";
import UsageHistory from "@/components/UsageHistory";
import UsageGuide from "@/components/UsageGuide";
import { Button } from "@/components/ui/button";
import { Settings2, Gauge } from "lucide-react";

export default function Dashboard() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [active, setActive] = useState(null);
  const [history, setHistory] = useState([]);
  const [balance, setBalance] = useState(null);
  const [gateway, setGateway] = useState(null);

  const loadGateway = useCallback(async () => {
    try {
      const { data } = await api.get("/gateway/status");
      setGateway(data);
    } catch (e) {}
  }, []);

  useEffect(() => {
    loadGateway();
    const t = setInterval(loadGateway, 5000);
    return () => clearInterval(t);
  }, [loadGateway]);

  const loadSettings = useCallback(async () => {
    try {
      const { data } = await api.get("/settings");
      setConfigured(data.configured);
      if (!data.configured) setSettingsOpen(true);
    } catch (e) {}
  }, []);

  const loadActive = useCallback(async () => {
    try {
      const { data } = await api.get("/proxy/active");
      setActive(data.active);
    } catch (e) {}
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const { data } = await api.get("/history");
      setHistory(data || []);
    } catch (e) {}
  }, []);

  const loadBalance = useCallback(async () => {
    try {
      const { data } = await api.get("/account/balance");
      setBalance(data);
    } catch (e) {
      setBalance(null);
    }
  }, []);

  useEffect(() => {
    loadSettings();
    loadActive();
    loadHistory();
    loadBalance();
  }, [loadSettings, loadActive, loadHistory, loadBalance]);

  const onActivated = () => {
    loadActive();
    loadHistory();
  };

  const gb = balance?.proxy?.rotating?.total?.traffic?.availableGb;

  return (
    <div className="min-h-screen flex bg-background">
      <Sidebar onOpenSettings={() => setSettingsOpen(true)} configured={configured} />

      <main className="flex-1 min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-30 backdrop-blur-md bg-background/70 border-b border-line px-6 py-3 flex items-center justify-between">
          <div className="flex items-baseline gap-3">
            <h1 className="font-heading text-xl md:text-2xl tracking-tight">Proxy Gateway</h1>
            <span className="overline hidden sm:inline">FloppyData · 1 IP Router</span>
          </div>
          <div className="flex items-center gap-3">
            {gb != null && (
              <div className="hidden sm:flex items-center gap-1.5 font-mono text-xs text-dim border border-line px-2.5 py-1.5">
                <Gauge size={13} className="text-laser" />
                <span className="text-laser">{gb.toFixed(2)} GB</span> tersisa
              </div>
            )}
            <Button
              onClick={() => setSettingsOpen(true)}
              variant="outline"
              size="sm"
              className="rounded-none border-line hover:border-neon hover:text-neon font-mono text-xs h-8"
              data-testid="topbar-settings-btn"
            >
              <Settings2 size={14} /> API Key
            </Button>
          </div>
        </header>

        <div className="p-6 space-y-6">
          {/* Row 1: active + architecture */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4">
              <ActiveProxyCard active={active} />
            </div>
            <div className="lg:col-span-8">
              <ArchitectureFlow active={active} gateway={gateway} />
            </div>
          </div>

          {/* Row 2: IP pool (full width) */}
          <IPPool active={active} onActivated={onActivated} />

          {/* Row 3: tools + usage guide */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4">
              <ProxyTools active={active} gateway={gateway} />
            </div>
            <div className="lg:col-span-8">
              <UsageGuide active={active} gateway={gateway} />
            </div>
          </div>

          {/* Row 4: history */}
          <UsageHistory items={history} onChanged={onActivated} />

          <footer className="pt-2 pb-6 text-center">
            <span className="font-mono text-[10px] text-dim tracking-widest uppercase">
              FloppyData Proxy Gateway · tugas jaringan
            </span>
          </footer>
        </div>
      </main>

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        onSaved={() => {
          loadSettings();
          loadBalance();
        }}
      />
    </div>
  );
}
