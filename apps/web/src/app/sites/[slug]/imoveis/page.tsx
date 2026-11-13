"use client";
import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BedDouble, Bath, Car, Ruler, MapPin, Search, Megaphone, Tag } from "lucide-react";
import { formatBRL } from "../../../../lib/money";

type Item = { id: string; kind: string; slug: string; title: string; excerpt?: string | null; coverUrl?: string | null; data: any; publishedAt?: string | null; createdAt: string };
type Site = { slug: string; name: string; primaryColor: string; accentColor: string; items: Item[] };
type Options = { pretensions: string[]; types: { Urbano: string[]; Rural: string[] }; regions: string[]; neighborhoods: string[] };

const safeImg = (url?: string | null) => url && (/^https?:\/\//i.test(url) || /^\/(?!\/)/.test(url)) ? url : null;
const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  SOLD: { label: "Vendido", className: "ps-badge-sold" },
  RENTED: { label: "Alugado", className: "ps-badge-rented" },
  UNAVAILABLE: { label: "Indisponível", className: "ps-badge-unavailable" },
};
const matchesMin = (value: any, min: number) => min <= 0 || (Number(value) || 0) >= min;

export default function SiteImoveisPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [site, setSite] = useState<Site | null>(null);
  const [options, setOptions] = useState<Options | null>(null);
  const [error, setError] = useState("");
  const [city, setCity] = useState("");
  const [pretension, setPretension] = useState("");
  const [category, setCategory] = useState("");
  const [propertyType, setPropertyType] = useState("");
  const [region, setRegion] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [code, setCode] = useState("");
  const [beds, setBeds] = useState("");
  const [baths, setBaths] = useState("");
  const [parking, setParking] = useState("");
  const [areaMin, setAreaMin] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(true);

  useEffect(() => {
    fetch("/api/backend/public/sites/" + encodeURIComponent(slug), { cache: "no-store" })
      .then(async r => { const data = await r.json().catch(() => ({})); if (!r.ok) throw new Error("Este site não está disponível no momento."); return data?.site && typeof data.site === "object" ? data.site : data; })
      .then((normalized: any) => { setSite({ ...normalized, items: Array.isArray(normalized?.items) ? normalized.items.filter((i: Item) => i.kind === "property") : [] }); })
      .catch(e => setError(e instanceof Error ? e.message : "Não foi possível carregar."));
    fetch("/api/backend/public/sites/" + encodeURIComponent(slug) + "/real-estate-options", { cache: "no-store" })
      .then(async r => (r.ok ? r.json() : null))
      .then(value => setOptions(value))
      .catch(() => setOptions(null));
  }, [slug]);

  const filtered = useMemo(() => {
    if (!site) return [];
    const codeNeedle = code.trim().toLowerCase();
    return site.items.filter(item => {
      const d = item.data || {};
      if (city && !String(d.city || "").toLowerCase().includes(city.toLowerCase())) return false;
      if (pretension && d.pretension !== pretension) return false;
      if (category && d.category !== category) return false;
      if (propertyType && d.propertyType !== propertyType) return false;
      if (region && d.region !== region && !String(d.region || "").toLowerCase().includes(region.toLowerCase())) return false;
      if (neighborhood && !String(d.neighborhood || "").toLowerCase().includes(neighborhood.toLowerCase())) return false;
      if (codeNeedle && !String(d.code || "").toLowerCase().includes(codeNeedle) && !String(item.slug || "").toLowerCase().includes(codeNeedle)) return false;
      if (!matchesMin(d.beds, Number(beds) || 0)) return false;
      if (!matchesMin(d.baths, Number(baths) || 0)) return false;
      if (!matchesMin(d.parkingSpaces, Number(parking) || 0)) return false;
      if (!matchesMin(d.area, Number(areaMin) || 0)) return false;
      return true;
    });
  }, [site, city, pretension, category, propertyType, region, neighborhood, code, beds, baths, parking, areaMin]);

  const typeOptions = options?.types?.[category === "Rural" ? "Rural" : "Urbano"] || [];
  const clearFilters = () => { setCity(""); setPretension(""); setCategory(""); setPropertyType(""); setRegion(""); setNeighborhood(""); setCode(""); setBeds(""); setBaths(""); setParking(""); setAreaMin(""); };
  const filtersActive = [city, pretension, category, propertyType, region, neighborhood, code, beds, baths, parking, areaMin].some(v => v);

  if (error) return <main className="ps-post-shell"><section className="ps-post-error"><h1>Imóveis</h1><p>{error}</p><Link className="ps-btn" href={"/sites/" + slug}>Voltar ao site</Link></section></main>;
  if (!site) return <main className="ps-post-shell"><section className="ps-post-error" role="status"><p>Carregando imóveis…</p></section></main>;

  return (
    <main className="ps-post-shell" style={{ ["--site-primary" as any]: site.primaryColor, ["--site-accent" as any]: site.accentColor } as React.CSSProperties}>
      <header className="ps-post-header">
        <Link className="ps-post-back" href={"/sites/" + slug}><ArrowLeft size={17} aria-hidden="true" /> {site.name}</Link>
        <Link className="ps-btn ps-property-cta" href={"/sites/" + slug + "/anunciar"}><Megaphone size={16} aria-hidden="true" /> Anunciar meu imóvel</Link>
      </header>
      <section className="ps-property-index">
        <div className="ps-property-index-head">
          <div><h1>Imóveis</h1><p>{filtered.length} {filtered.length === 1 ? "imóvel disponível" : "imóveis disponíveis"}{filtersActive ? " (filtrados)" : ""}</p></div>
          <button type="button" className="secondary-button ps-filter-toggle" onClick={() => setFiltersOpen(v => !v)} aria-expanded={filtersOpen}><Search size={15} aria-hidden="true" /> Filtros</button>
        </div>
        {filtersOpen && (
          <div className="ps-property-filters" aria-label="Filtros de imóveis">
            <label><span>Cidade</span><input value={city} onChange={e => setCity(e.target.value)} placeholder="Ex.: Alto Araguaia" list="ps-cities" /><datalist id="ps-cities">{(site.items.map(i => String(i.data?.city || "")).filter(Boolean) as string[]).filter((v, i, a) => a.indexOf(v) === i).map(c => <option key={c} value={c} />)}</datalist></label>
            <label><span>Pretensão</span><select value={pretension} onChange={e => setPretension(e.target.value)}><option value="">Todas</option>{(options?.pretensions || []).map(p => <option key={p} value={p}>{p}</option>)}</select></label>
            <label><span>Categoria</span><select value={category} onChange={e => { setCategory(e.target.value); setPropertyType(""); }}><option value="">Todas</option><option value="Urbano">Urbano</option><option value="Rural">Rural</option></select></label>
            <label><span>Tipo</span><select value={propertyType} onChange={e => setPropertyType(e.target.value)}><option value="">Todos</option>{typeOptions.map(t => <option key={t} value={t}>{t}</option>)}</select></label>
            <label><span>Região</span><input value={region} onChange={e => setRegion(e.target.value)} placeholder="Ex.: Centro" list="ps-regions" /><datalist id="ps-regions">{(options?.regions || []).map(r => <option key={r} value={r} />)}</datalist></label>
            <label><span>Bairro</span><input value={neighborhood} onChange={e => setNeighborhood(e.target.value)} placeholder="Ex.: Jardim América" list="ps-neighborhoods" /><datalist id="ps-neighborhoods">{(site.items.map(i => String(i.data?.neighborhood || "")).filter(Boolean) as string[]).filter((v, i, a) => a.indexOf(v) === i).map(v => <option key={v} value={v} />)}{(options?.neighborhoods || []).map(v => <option key={v} value={v} />)}</datalist></label>
            <label><span>Quartos (mín.)</span><input type="number" min={0} value={beds} onChange={e => setBeds(e.target.value)} placeholder="0" /></label>
            <label><span>Banheiros (mín.)</span><input type="number" min={0} value={baths} onChange={e => setBaths(e.target.value)} placeholder="0" /></label>
            <label><span>Vagas (mín.)</span><input type="number" min={0} value={parking} onChange={e => setParking(e.target.value)} placeholder="0" /></label>
            <label><span>Área mín. (m²)</span><input type="number" min={0} value={areaMin} onChange={e => setAreaMin(e.target.value)} placeholder="0" /></label>
            <label><span>Código</span><input value={code} onChange={e => setCode(e.target.value)} placeholder="IMO-0001" /></label>
            <button type="button" className="text-button ps-filter-clear" onClick={clearFilters}>Limpar filtros</button>
          </div>
        )}
        <div className="ps-items">
          {filtered.map(item => {
            const d = item.data || {};
            const cover = safeImg(item.coverUrl) || safeImg(String(d.images?.[0]?.url || ""));
            const badge = STATUS_BADGE[String(d.status || "")];
            return (
              <a key={item.id} className="ps-item-card" href={"/sites/" + slug + "/imoveis/" + item.slug} style={{ textDecoration: "none", color: "inherit" }}>
                <div className="ps-property-card-media">
                  {cover ? <img src={cover} alt={item.title} loading="lazy" /> : <div className="ps-property-card-nomedia"><Tag size={26} aria-hidden="true" /></div>}
                  {badge && <span className={"ps-status-badge " + badge.className}>{badge.label}</span>}
                  {d.code && <span className="ps-code-badge">{String(d.code)}</span>}
                </div>
                <div className="ps-property-card-body">
                  {d.price && <p className="ps-price">{formatBRL(String(d.price))}</p>}
                  <h3>{item.title}</h3>
                  <p className="ps-property-card-location">{d.neighborhood ? d.neighborhood + " · " : ""}{d.city || ""}</p>
                  <ul className="ps-property-card-facts">
                    {d.beds !== undefined && d.beds !== "" && <li><BedDouble size={14} aria-hidden="true" /> {d.beds} qts</li>}
                    {d.baths !== undefined && d.baths !== "" && <li><Bath size={14} aria-hidden="true" /> {d.baths} ban</li>}
                    {d.parkingSpaces !== undefined && d.parkingSpaces !== "" && <li><Car size={14} aria-hidden="true" /> {d.parkingSpaces} vagas</li>}
                    {d.area !== undefined && d.area !== "" && <li><Ruler size={14} aria-hidden="true" /> {d.area} m²</li>}
                  </ul>
                </div>
              </a>
            );
          })}
          {!filtered.length && <p className="ps-field-hint">Nenhum imóvel encontrado com esses filtros. Tente ampliar a busca.</p>}
        </div>
      </section>
      <footer className="ps-post-footer"><p>{site.name} · Desenvolvido por <a href="https://vexorasuite.com.br" target="_blank" rel="noreferrer">Véxora Suite</a></p></footer>
    </main>
  );
}
