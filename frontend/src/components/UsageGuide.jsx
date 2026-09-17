import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { BookOpen, Copy, Check } from "lucide-react";

function buildSnippets(p) {
  const proto = (p.protocol || "http").toLowerCase();
  const socks = proto === "socks5";
  const scheme = socks ? "socks5h" : proto;
  const { host, port, username: u, password: pw } = p;
  return [
    {
      id: "curl",
      label: "curl",
      note: socks ? "socks5h = DNS di-resolve oleh proxy (disarankan)." : "Proxy HTTP/HTTPS standar.",
      code: `curl -x ${scheme}://${u}:${pw}@${host}:${port} https://api.ipify.org`,
    },
    {
      id: "windows",
      label: "Windows / macOS",
      note: socks
        ? "Windows Settings hanya mendukung HTTP proxy. Untuk SOCKS5 pakai Proxifier / ekstensi browser (FoxyProxy), atau setel di macOS: System Settings → Network → Proxies → SOCKS Proxy."
        : "Settings → Network & Internet → Proxy → Manual proxy setup. Username & password diminta saat pertama browsing.",
      code: socks
        ? `SOCKS Host : ${host}\nPort       : ${port}\nUsername   : ${u}\nPassword   : ${pw}`
        : `Address  : ${host}\nPort     : ${port}\nUsername : ${u}\nPassword : ${pw}`,
    },
    {
      id: "firefox",
      label: "Firefox",
      note: "Settings → Network Settings → Manual proxy configuration. Centang “Proxy DNS when using SOCKS v5”.",
      code: socks
        ? `SOCKS Host : ${host}   Port : ${port}\nSOCKS v5   : ✓\nProxy DNS when using SOCKS v5 : ✓\nLogin      : ${u}\nPassword   : ${pw}`
        : `HTTP Proxy  : ${host}   Port : ${port}\n☑ Also use this proxy for HTTPS\nLogin       : ${u}\nPassword    : ${pw}`,
    },
    {
      id: "telegram",
      label: "Telegram",
      note: socks
        ? "Settings → Advanced → Connection type → Use custom proxy → SOCKS5."
        : "Telegram hanya mendukung SOCKS5/MTProto. Build ulang proxy dengan protocol SOCKS5.",
      code: socks
        ? `tg://socks?server=${host}&port=${port}&user=${encodeURIComponent(u)}&pass=${encodeURIComponent(pw)}`
        : `# build proxy dengan Protocol = SOCKS5 terlebih dahulu`,
    },
    {
      id: "python",
      label: "Python",
      note: socks ? "pip install requests[socks]" : "pip install requests",
      code: `import requests\n\nproxy = "${scheme}://${u}:${pw}@${host}:${port}"\nr = requests.get("https://api.ipify.org?format=json",\n                 proxies={"http": proxy, "https": proxy}, timeout=30)\nprint(r.json())`,
    },
    {
      id: "env",
      label: "Shell env",
      note: "Berlaku untuk hampir semua CLI (git, pip, wget, npm).",
      code: `export HTTP_PROXY="${scheme}://${u}:${pw}@${host}:${port}"\nexport HTTPS_PROXY="${scheme}://${u}:${pw}@${host}:${port}"\nexport ALL_PROXY="${scheme}://${u}:${pw}@${host}:${port}"`,
    },
  ];
}

function CopyBtn({ text, id }) {
  const [ok, setOk] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setOk(true);
    toast.success("Disalin ke clipboard");
    setTimeout(() => setOk(false), 1500);
  };
  return (
    <Button
      onClick={copy}
      variant="outline"
      size="sm"
      className="rounded-none border-line hover:border-neon hover:text-neon h-7 px-2 font-mono text-xs"
      data-testid={`guide-copy-${id}`}
    >
      {ok ? <Check size={13} className="text-laser" /> : <Copy size={13} />} copy
    </Button>
  );
}

export default function UsageGuide({ active }) {
  if (!active) {
    return (
      <div className="card-panel p-5 flex items-center gap-3" data-testid="usage-guide-empty">
        <BookOpen size={18} className="text-dim" />
        <div>
          <span className="overline">Cara Pakai</span>
          <p className="text-sm text-dim">Aktifkan proxy dulu, panduan konfigurasi siap-copy akan muncul di sini.</p>
        </div>
      </div>
    );
  }

  const snippets = buildSnippets(active);
  const proto = (active.protocol || "http").toUpperCase();

  return (
    <div className="card-panel" data-testid="usage-guide">
      <div className="p-5 pb-3 border-b border-line flex items-center justify-between">
        <div>
          <span className="overline">Step 3 · Gunakan di aplikasi lain</span>
          <h3 className="font-heading text-lg tracking-tight">Cara Pakai · {proto}</h3>
        </div>
        <span className="font-mono text-xs text-dim border border-line px-2 py-1" data-testid="usage-guide-endpoint">
          {active.host}:{active.port}
        </span>
      </div>

      <Tabs defaultValue="curl" className="p-4">
        <TabsList className="bg-black border border-line rounded-none h-auto flex-wrap justify-start gap-1 p-1">
          {snippets.map((s) => (
            <TabsTrigger
              key={s.id}
              value={s.id}
              className="rounded-none font-mono text-xs data-[state=active]:bg-neon data-[state=active]:text-black"
              data-testid={`guide-tab-${s.id}`}
            >
              {s.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {snippets.map((s) => (
          <TabsContent key={s.id} value={s.id} className="mt-3 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <p className="text-xs text-dim">{s.note}</p>
              <CopyBtn text={s.code} id={s.id} />
            </div>
            <pre className="bg-black border border-line p-3 font-mono text-[11px] text-foreground whitespace-pre-wrap break-all" data-testid={`guide-code-${s.id}`}>
              {s.code}
            </pre>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
