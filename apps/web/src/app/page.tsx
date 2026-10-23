export default function HomePage() {
  return (
    <main className="shell">
      <section className="panel" aria-labelledby="welcome-title">
        <div className="mark" aria-hidden="true">V</div>
        <p className="eyebrow">NOVA PLATAFORMA · AMBIENTE DE TESTES</p>
        <h1 id="welcome-title">Véxora Suite</h1>
        <p className="intro">
          A fundação está sendo preparada em um ambiente separado. A Véxora Matriz
          permanece independente enquanto validamos cada etapa.
        </p>
        <div className="status" role="status">
          <span className="status-dot" />
          Base inicial — implantação e validações pendentes
        </div>
        <p className="footnote">Próxima etapa: configurar banco, health checks e CI.</p>
      </section>
    </main>
  );
}
