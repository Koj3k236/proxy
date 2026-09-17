import { Network, Github, Settings2, Radio } from "lucide-react";

export default function Sidebar({ onOpenSettings, configured }) {
  return (
    <aside className="hidden md:flex flex-col justify-between w-16 shrink-0 border-r border-line bg-panel/60 backdrop-blur-sm py-5">
      <div className="flex flex-col items-center gap-6">
        <div className="w-9 h-9 grid place-items-center border border-neon/50 text-neon neon-glow" data-testid="logo">
          <Network size={18} />
        </div>
        <nav className="flex flex-col items-center gap-4 text-dim">
          <button className="w-9 h-9 grid place-items-center text-neon" title="Gateway" data-testid="nav-gateway">
            <Radio size={18} />
          </button>
        </nav>
      </div>
      <div className="flex flex-col items-center gap-4">
        <div
          className={`w-2 h-2 rounded-full ${configured ? "bg-laser laser-glow animate-pulse-dot" : "bg-signal"}`}
          title={configured ? "API terhubung" : "API belum diatur"}
          data-testid="api-status-dot"
        />
        <button
          onClick={onOpenSettings}
          className="w-9 h-9 grid place-items-center text-dim hover:text-neon transition-colors duration-150"
          title="Settings / API Key"
          data-testid="open-settings-btn"
        >
          <Settings2 size={18} />
        </button>
        <a
          href="https://floppydata.com/docs"
          target="_blank"
          rel="noreferrer"
          className="w-9 h-9 grid place-items-center text-dim hover:text-foreground transition-colors duration-150"
          title="FloppyData Docs"
        >
          <Github size={18} />
        </a>
      </div>
    </aside>
  );
}
