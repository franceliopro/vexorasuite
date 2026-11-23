import type { Metadata } from "next";
import { notFound } from "next/navigation";
import GestaoDeFrotas from "@/content/pages/gestao-de-frotas.mdx";
import LpInfo from "@/content/pages/lp-info.mdx";
import PoliticaDePrivacidade from "@/content/pages/politica-de-privacidade.mdx";
import Rastreacard from "@/content/pages/rastreacard.mdx";
import Rastreamento from "@/content/pages/rastreamento.mdx";
import TermosECondicoes from "@/content/pages/termos-e-condicoes.mdx";
import { findPage, navigation } from "@/content/navigation";

const pages: Record<string, React.ComponentType> = {
  rastreamento: Rastreamento,
  "gestao-de-frotas": GestaoDeFrotas,
  rastreacard: Rastreacard,
  "lp-info": LpInfo,
  "politica-de-privacidade": PoliticaDePrivacidade,
  "termos-e-condicoes": TermosECondicoes,
};

export function generateStaticParams() {
  return navigation.filter((page) => page.slug !== "index").map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = findPage(slug);
  if (!page) return {};
  return { title: page.title, description: page.description };
}

export default async function SitePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const Content = pages[slug];
  if (!Content) notFound();
  return <Content />;
}
