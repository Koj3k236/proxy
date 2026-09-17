import { useState, useEffect, useMemo } from "react";
import { api, countryFlag, errMsg } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Loader2, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import BuildDialog from "@/components/BuildDialog";

const TYPES = ["residential", "mobile", "datacenter"];

export default function ProxyList({ onActivated }) {
  const [type, setType] = useState("residential");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState(null);

  const load = async (t) => {
    setLoading(true);
    try {
      const { data } = await api.get("/locations", { params: { type: t } });
      setItems(data.items || []);
    } catch (e) {
      toast.error(errMsg(e));
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(type);
  }, [type]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter(
      (i) => i.name.toLowerCase().includes(s) || i.countryCode.toLowerCase().includes(s)
    );
  }, [items, q]);

  return (
    <div className="card-panel h-full flex flex-col" data-testid="proxy-list">
      <div className="p-5 pb-3 border-b border-line">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <span className="overline">Step 1 · Ambil & Filter</span>
            <h3 className="font-heading text-lg tracking-tight">Daftar Proxy FloppyData</h3>
          </div>
          <Tabs value={type} onValueChange={setType}>
            <TabsList className="bg-black border border-line rounded-none h-9">
              {TYPES.map((t) => (
                <TabsTrigger
                  key={t}
                  value={t}
                  className="rounded-none font-mono text-xs data-[state=active]:bg-neon data-[state=active]:text-black uppercase"
                  data-testid={`type-tab-${t}`}
                >
                  {t}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
        <div className="relative mt-3">
          <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-dim" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="cari negara atau kode (mis. US, Japan)..."
            className="pl-8 bg-black border-line font-mono text-sm focus-visible:ring-neon rounded-none"
            data-testid="proxy-search"
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto max-h-[420px]">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-dim gap-2 font-mono text-sm">
            <Loader2 className="animate-spin" size={16} /> memuat locations...
          </div>
        ) : (
          <Table>
            <TableHeader className="sticky top-0 bg-panel z-10">
              <TableRow className="border-line hover:bg-transparent">
                <TableHead className="overline">Country</TableHead>
                <TableHead className="overline">Code</TableHead>
                <TableHead className="overline">Gateway</TableHead>
                <TableHead className="overline">Cities</TableHead>
                <TableHead className="overline text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((loc, idx) => (
                <TableRow
                  key={loc.countryCode + idx}
                  className="border-line hover:bg-neon/5 animate-fade-up"
                  style={{ animationDelay: `${Math.min(idx, 20) * 15}ms` }}
                  data-testid={`proxy-row-${loc.countryCode}`}
                >
                  <TableCell className="font-sans">
                    <span className="mr-2">{countryFlag(loc.countryCode)}</span>
                    {loc.name}
                  </TableCell>
                  <TableCell className="font-mono text-neon">{loc.countryCode}</TableCell>
                  <TableCell className="font-mono text-xs text-dim">geo.g-w.info:10080</TableCell>
                  <TableCell className="font-mono text-xs text-dim">{loc.cities?.length || 0}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelected({ ...loc, type })}
                      className="rounded-none border-line hover:border-neon hover:text-neon font-mono text-xs h-7"
                      data-testid={`select-proxy-${loc.countryCode}`}
                    >
                      SELECT <ChevronRight size={13} />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-dim py-10 font-mono text-sm">
                    tidak ada hasil
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>

      <BuildDialog
        location={selected}
        onClose={() => setSelected(null)}
        onActivated={(p) => {
          setSelected(null);
          onActivated && onActivated(p);
        }}
      />
    </div>
  );
}
