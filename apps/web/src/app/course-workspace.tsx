"use client";
import { useEffect, useState } from "react";
import { GraduationCap, CheckCircle2, Circle, Printer, ChevronRight, Clock, PlayCircle } from "lucide-react";

const primaryTw = "inline-flex min-h-control items-center justify-center gap-2 rounded-token-sm bg-blue-600 px-4 text-body font-bold text-blue-50 shadow-token-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60";
const LESSONS = [
  {
    id: "boas-vindas",
    title: "1. Boas-vindas e visão da plataforma",
    duration: "8 min",
    summary: "Tour pela Visão geral, módulos e sidebar: entenda o que a Véxora faz numa única tela.",
    does: ["Acesso e tema (claro, híbrido e escuro)", "Visão geral e indicadores ao vivo", "Onde ficar cada módulo no menu"],
  },
  {
    id: "atendimento",
    title: "2. Atendimento e inbox compartilhado",
    duration: "12 min",
    summary: "Como receber, distribuir e responder clientes de vários canais em um só lugar, com protocolos.",
    does: ["Filas, transferência e permissões por atendente", "Notas privadas e @menções", "Áudio, transcrição e respostas rápidas"],
  },
  {
    id: "crm",
    title: "3. CRM de verdade: funil e cobrança na conversa",
    duration: "10 min",
    summary: "Pipeline com etapas, cards organizados e régua de cobrança automatizada via Asaas.",
    does: ["Funil por setor: arraste, mova e ganhe", "Cobrança no chat e inadimplência sob controle", "Relatórios de diretoria em um clique"],
  },
  {
    id: "automacao",
    title: "4. Robôs e agentes de IA sob suas regras",
    duration: "15 min",
    summary: "Crie robôs com o assistente “Crie com IA”, publique e deixe a IA qualificar e atender.",
    does: ["Criar robô com o botão “Crie com IA”", "Publicar por setor e por atendente", "Assumir conversas e revisar a IA"],
  },
  {
    id: "documentos",
    title: "5. Orçamentos, contratos e ordens de serviço",
    duration: "10 min",
    summary: "Documentos profissionais gerados a partir dos dados do cliente — em PDF, prontos para assinar.",
    does: ["Modelos com variáveis próprias", "Preenchimento automático com dados do cliente", "PDF para enviar ou imprimir"],
  },
  {
    id: "financeiro",
    title: "6. Financeiro com Asaas na conversa",
    duration: "9 min",
    summary: "Cobranças, boletos/PIX e inadimplência tratados dentro do atendimento.",
    does: ["Sincronizar clientes com o Asaas", "Ver cobrança e status na ficha do cliente", "Medir recebimento nos relatórios"],
  },
  {
    id: "gestao",
    title: "7. Gestão: relatórios e o operador do dia a dia",
    duration: "11 min",
    summary: "Saída executiva: o painel do dono com números, sem depender de planilha.",
    does: ["Relatórios executivos e exportação CSV/PDF", "Agenda e tarefas com responsáveis", "Permissões e setores para cada atendente"],
  },
] as const;

const STORAGE_KEY = "vexora:course-progress";

export function CourseWorkspace({ companyName = "Sua empresa" }: { companyName?: string }) {
  const [done, setDone] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) { const parsed = JSON.parse(raw); setDone(Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : []); }
    } catch {}
    setLoaded(true);
  }, []);

  const toggle = (id: string) => {
    setDone((current) => {
      const next = current.includes(id) ? current.filter((v) => v !== id) : [...current, id];
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const completed = done.length;
  const total = LESSONS.length;
  const pct = Math.round((completed / total) * 100);
  const finished = completed === total;

  return (
    <section className="course-workspace">
      <header className="course-hero">
        <GraduationCap size={34} aria-hidden="true" />
        <div>
          <h1>Curso Véxora — Onboarding do dono</h1>
          <p>Sete aulas curtas para a sua empresa operar no nível de uma grande — sem planilha, sem caos, sem esperar alguém ensinar.</p>
          <div className="course-progress" aria-label={`Progresso do curso: ${completed} de ${total} aulas`}>
            <div className="course-progress-track"><span style={{ width: pct + "%" }} /></div>
            <strong>{completed}/{total} · {pct}%</strong>
          </div>
        </div>
        {finished ? <button type="button" className={primaryTw + " course-print"} onClick={() => window.print()}><Printer size={16} aria-hidden="true" /> Certificado</button> : null}
      </header>

      <ol className="course-lessons">
        {LESSONS.map((lesson) => {
          const isDone = done.includes(lesson.id);
          return (
            <li key={lesson.id} className={"course-lesson" + (isDone ? " is-done" : "")}>
              <button type="button" className="course-lesson-toggle" aria-pressed={isDone} onClick={() => toggle(lesson.id)} aria-label={isDone ? "Marcar aula como pendente" : "Marcar aula como concluída"}>
                {isDone ? <CheckCircle2 size={20} className="course-lesson-mark" aria-hidden="true" /> : <Circle size={20} className="course-lesson-mark" aria-hidden="true" />}
              </button>
              <div className="course-lesson-body">
                <div className="course-lesson-head">
                  <h2>{lesson.title}</h2>
                  <span className="course-lesson-duration"><Clock size={12} aria-hidden="true" />{lesson.duration}</span>
                </div>
                <p>{lesson.summary}</p>
                <ul className="course-lesson-points">{lesson.does.map((point) => <li key={point}><ChevronRight size={11} aria-hidden="true" />{point}</li>)}</ul>
                <div className="course-lesson-foot"><span className="course-lesson-badge"><PlayCircle size={13} aria-hidden="true" /> Vídeo em produção — disponível em breve</span><span className="course-lesson-cta">Enquanto isso, cada aula é guiada por esta página + a Central de Ajuda.</span></div>
              </div>
            </li>
          );
        })}
      </ol>

      {finished ? (
        <article className="course-certificate" aria-label="Certificado de conclusão">
          <div className="course-certificate-inner">
            <GraduationCap size={44} aria-hidden="true" />
            <span className="course-certificate-eyebrow">CERTIFICADO DE CONCLUSÃO</span>
            <h2>Véxora Suite — Onboarding do dono</h2>
            <p className="course-certificate-name">{companyName}</p>
            <p className="course-certificate-text">concluiu todas as aulas do programa de ativação da plataforma Véxora Suite.</p>
            <p className="course-certificate-foot">{new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })} · Véxora Suite</p>
          </div>
        </article>
      ) : null}
    </section>
  );
}
