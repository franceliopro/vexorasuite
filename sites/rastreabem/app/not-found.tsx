import Link from "next/link";

export default function NotFound() {
  return (
    <main id="conteudo" className="wrap" style={{ paddingBlock: 80 }}>
      <h1 className="section-title">Página não encontrada</h1>
      <p style={{ marginTop: 24 }}>
        <Link className="button" href="/">
          Voltar para o início
        </Link>
      </p>
    </main>
  );
}
