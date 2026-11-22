"use client";
import { useEffect, useState } from "react";
import { GraduationCap, CheckCircle2, Circle, Printer, ChevronRight, Clock, PlayCircle } from "lucide-react";

const primaryTw = "inline-flex min-h-control items-center justify-center gap-2 rounded-token-sm bg-blue-600 px-4 text-body font-bold text-blue-50 shadow-token-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60";
const heroTw = "flex items-center gap-course-gap rounded-course-hero border border-line bg-course-hero p-course-hero-pad";
const heroIconTw = "size-course-icon shrink-0 text-blue-600";
const heroTitleTw = "m-0 font-display text-course-title font-extrabold text-ink";
const heroCopyTw = "mb-2.5 mt-1 max-w-course-copy text-course-hero-copy text-ink-secondary";
const progressTw = "flex items-center gap-2.5";
const progressTrackTw = "h-course-track-h w-course-track-w overflow-hidden rounded-full bg-surface-3";
const progressFillTw = "block h-full rounded-full bg-course-progress transition-course duration-bar ease-token";
const progressValueTw = "text-course-progress text-ink-secondary";
const printButtonTw = `${primaryTw} ml-auto shrink-0`;
const lessonsTw = "m-0 grid list-none gap-3 p-0 print:hidden";
const lessonTw = "flex items-start gap-3.5 rounded-course-card border bg-surface p-course-card-pad transition-colors duration-course";
const lessonBorderTw = "border-line";
const lessonDoneBorderTw = "border-course-done-line";
const lessonToggleTw = "shrink-0 cursor-pointer border-0 bg-transparent p-0.5 text-ink-secondary";
const lessonMarkTw = "text-ink-secondary";
const lessonMarkDoneTw = "text-success";
const lessonBodyTw = "grid min-w-0 gap-1.5";
const lessonHeadTw = "flex flex-wrap items-baseline justify-between gap-3";
const lessonTitleTw = "m-0 font-display text-course-card-title font-heading text-ink";
const lessonDurationTw = "inline-flex items-center gap-course-duration-gap whitespace-nowrap text-course-meta font-heading text-ink-secondary";
const lessonCopyTw = "m-0 text-course-copy leading-normal text-ink-secondary";
const lessonPointsTw = "mt-0.5 grid list-none gap-course-point-gap p-0 text-course-points text-ink-secondary";
const lessonPointTw = "flex items-center gap-1.5";
const lessonFootTw = "mt-0.5 flex flex-wrap gap-2.5 text-course-meta text-ink-secondary";
const lessonBadgeTw = "inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-course-badge-x py-course-badge-y font-ov";
const certificateTw = "grid place-items-center p-5 print:block";
const certificateInnerTw = "grid max-w-course-certificate justify-items-center gap-2 rounded-course-certificate border-2 border-course-cert-line bg-course-certificate px-course-inner-x py-course-inner-y text-center print:max-w-none print:w-full print:rounded-none print:border-0 print:bg-white";
const certificateIconTw = "size-course-cert-icon text-blue-600";
const certificateEyebrowTw = "font-display text-course-eyebrow font-extrabold tracking-course-eyebrow text-ink-secondary";
const certificateTitleTw = "m-0 font-display text-course-cert-title font-extrabold text-ink";
const certificateNameTw = "m-0 font-display text-course-name font-extrabold text-blue-800";
const certificateTextTw = "m-0 text-course-hero-copy text-ink-secondary";
const certificateFootTw = "m-0 text-course-progress text-ink-secondary";
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
    <section className="grid max-w-course gap-course-gap">
      <header className={heroTw}>
        <GraduationCap size={34} className={heroIconTw} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h1 className={heroTitleTw}>Curso Véxora — Onboarding do dono</h1>
          <p className={heroCopyTw}>Sete aulas curtas para a sua empresa operar no nível de uma grande — sem planilha, sem caos, sem esperar alguém ensinar.</p>
          <div className={progressTw} aria-label={`Progresso do curso: ${completed} de ${total} aulas`}>
            <div className={progressTrackTw}><span className={progressFillTw} style={{ width: pct + "%" }} /></div>
            <strong className={progressValueTw}>{completed}/{total} · {pct}%</strong>
          </div>
        </div>
        {finished ? <button type="button" data-testid="course-print" className={printButtonTw} onClick={() => window.print()}><Printer size={16} aria-hidden="true" /> Certificado</button> : null}
      </header>

      <ol className={lessonsTw}>
        {LESSONS.map((lesson) => {
          const isDone = done.includes(lesson.id);
          return (
            <li key={lesson.id} className={`${lessonTw} ${isDone ? lessonDoneBorderTw : lessonBorderTw}`}>
              <button type="button" className={lessonToggleTw} aria-pressed={isDone} onClick={() => toggle(lesson.id)} aria-label={isDone ? "Marcar aula como pendente" : "Marcar aula como concluída"}>
                {isDone ? <CheckCircle2 size={20} className={`${lessonMarkTw} ${lessonMarkDoneTw}`} aria-hidden="true" /> : <Circle size={20} className={lessonMarkTw} aria-hidden="true" />}
              </button>
              <div className={lessonBodyTw}>
                <div className={lessonHeadTw}>
                  <h2 className={lessonTitleTw}>{lesson.title}</h2>
                  <span className={lessonDurationTw}><Clock size={12} aria-hidden="true" />{lesson.duration}</span>
                </div>
                <p className={lessonCopyTw}>{lesson.summary}</p>
                <ul className={lessonPointsTw}>{lesson.does.map((point) => <li key={point} className={lessonPointTw}><ChevronRight size={11} aria-hidden="true" />{point}</li>)}</ul>
                <div className={lessonFootTw}><span className={lessonBadgeTw}><PlayCircle size={13} aria-hidden="true" /> Vídeo em produção — disponível em breve</span><span>Enquanto isso, cada aula é guiada por esta página + a Central de Ajuda.</span></div>
              </div>
            </li>
          );
        })}
      </ol>

      {finished ? (
        <article className={certificateTw} aria-label="Certificado de conclusão">
          <div className={certificateInnerTw}>
            <GraduationCap size={44} className={certificateIconTw} aria-hidden="true" />
            <span className={certificateEyebrowTw}>CERTIFICADO DE CONCLUSÃO</span>
            <h2 className={certificateTitleTw}>Véxora Suite — Onboarding do dono</h2>
            <p className={certificateNameTw}>{companyName}</p>
            <p className={certificateTextTw}>concluiu todas as aulas do programa de ativação da plataforma Véxora Suite.</p>
            <p className={certificateFootTw}>{new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })} · Véxora Suite</p>
          </div>
        </article>
      ) : null}
    </section>
  );
}
