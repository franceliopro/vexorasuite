"use client";

import { useState, useCallback, ReactNode } from "react";
import {
  X,
  Phone,
  Mail,
  Clock,
  CheckCircle,
  Plus,
  ChevronRight,
  Edit2,
  ArrowRight,
  ArrowLeft,
  Check,
  Folder,
  Users,
  Settings,
  MessageSquare,
} from "lucide-react";

const backdropTw = "fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6";
const scrimTw = "absolute inset-0 bg-overlay backdrop-blur-sm transition-opacity";
const cardTw = "relative z-10 flex max-h-ficha w-full max-w-md flex-col overflow-hidden rounded-token-xl border border-line bg-surface shadow-token-lg";
const headerTw = "flex items-center justify-between gap-3 border-b border-line p-5";
const tabsTw = "flex border-b border-line bg-surface-2";
const bodyTw = "flex-1 overflow-y-auto p-4";
const footerTw = "flex items-center justify-between gap-2 border-t border-line bg-surface-2 p-4";
const primaryButtonTw = "inline-flex items-center justify-center gap-1.5 rounded-token-sm bg-brand px-4 py-2 text-sm font-semibold text-brand-contrast shadow-token transition-all hover:bg-brand-strong active:scale-95";
const primaryButtonHiddenTw = "hidden inline-flex items-center justify-center gap-1.5 rounded-token-sm bg-brand px-4 py-2 text-sm font-semibold text-brand-contrast shadow-token transition-all hover:bg-brand-strong active:scale-95";
const fieldTw = "rounded-token-lg border border-line bg-surface-2 p-4";
const fieldRowTw = "flex items-center justify-between rounded-token-lg border border-line bg-surface-2 p-4";
const fieldRowSurfaceTw = "flex items-center justify-between rounded-token-lg border border-line bg-surface p-4";
const labelTw = "mb-2 text-2xs font-bold uppercase tracking-wider text-ink-muted";
const inputTw = "w-full bg-transparent text-sm text-ink outline-hidden";
const chipSuccessSmTw = "rounded-full border border-success-soft bg-success-soft px-2 py-1 text-2xs font-semibold text-success";
const chipSuccessMdTw = "rounded-full border border-success-soft bg-success-soft px-2.5 py-1 text-2xs font-semibold text-success";
const iconBoxTw = "flex h-9 w-9 items-center justify-center rounded-token-sm bg-brand-soft text-brand";
const iconMutedTw = "flex h-9 w-9 items-center justify-center rounded-token-sm bg-surface-3 text-ink-muted";
const statusOnlineTw = "rounded-full border border-success-soft bg-success-soft px-2 py-0.5 text-xs font-semibold text-success";
const statusOfflineTw = "rounded-full border border-line bg-surface-3 px-2 py-0.5 text-xs font-semibold text-ink-muted";
const tabActiveTw = "flex flex-1 flex-col items-center justify-center gap-1 border-b-2 border-brand bg-brand-soft px-3 py-3.5 text-xs font-medium text-brand transition-colors";
const tabInactiveTw = "flex flex-1 flex-col items-center justify-center gap-1 px-3 py-3.5 text-xs font-medium text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink-secondary";
const editDoneTw = "rounded-token-sm bg-surface-3 px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-line";
const editStartTw = "rounded-token-sm border border-line px-4 py-2 text-sm font-semibold text-ink-secondary transition-colors hover:bg-surface-2";
const wizardTw = "fixed inset-0 z-wizard flex items-center justify-center bg-overlay-soft p-4 backdrop-blur-sm";
const wizardCardTw = "relative flex max-h-wizard w-full max-w-sm flex-col overflow-hidden rounded-token-xl border border-line bg-surface shadow-token-lg";
const wizardHeaderTw = "flex items-start justify-between gap-3 border-b border-line p-5";
const wizardBodyTw = "flex-1 overflow-y-auto p-6";
const wizardStepTw = "space-y-4";
const wizardStepHiddenTw = "hidden space-y-4";
const wizardDoneTw = "flex flex-col items-center justify-center py-12 text-center";
const wizardDoneHiddenTw = "hidden flex flex-col items-center justify-center py-12 text-center";
const wizardBackTw = "rounded-token-sm border border-line px-3 py-2 text-sm font-semibold text-ink-secondary transition-colors hover:bg-surface-2";
const wizardBackHiddenTw = "hidden rounded-token-sm border border-line px-3 py-2 text-sm font-semibold text-ink-secondary transition-colors hover:bg-surface-2";
const wizardFinishTw = "inline-flex items-center justify-center rounded-token-sm bg-ink px-3 py-2 text-sm font-semibold text-brand-contrast transition-all hover:bg-ink-secondary active:scale-95";
const wizardFinishHiddenTw = "hidden inline-flex items-center justify-center rounded-token-sm bg-ink px-3 py-2 text-sm font-semibold text-brand-contrast transition-all hover:bg-ink-secondary active:scale-95";

type ContactStatus = "ativo" | "inativo";

type Contact = {
  id?: string;
  name: string;
  role?: string;
  status?: ContactStatus;
  stage?: string;
  phone?: string;
  phoneLabel?: string;
  email?: string;
  origin?: string;
  tags?: string[];
  address?: string;
};

type TabId = "dados" | "contato" | "historico" | "mais";

type FichaClienteProps = {
  contact?: Contact;
  open?: boolean;
  onClose?: () => void;
  onSave?: (data: Partial<Contact>) => void;
  onFinish?: () => void;
};

/**
 * Ficha de cliente — conceito "menos é mais".
 *
 * Regras de UX:
 * - Um único menu de navegação inferior com 4 abas essenciais.
 * - Nada de janelas empilhadas: o conteúdo da aba ativa ocupa a tela.
 * - Ações secundárias ficam escondidas atrás de um único botão "+".
 * - Wizard só aparece ao concluir, com passos curtos e linguagem simples.
 * - Fácil para qualquer pessoa operar, sem treinamento.
 */
export default function FichaCliente({
  contact,
  open = true,
  onClose,
  onSave,
  onFinish,
}: FichaClienteProps) {
  const [isOpen, setIsOpen] = useState(open);
  const [editing, setEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("dados");
  const [moreOpen, setMoreOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [termsChecked, setTermsChecked] = useState(false);

  const c: Contact = {
    id: contact?.id,
    name: contact?.name ?? "Paulo Aguiar",
    role: contact?.role ?? "Lead • etapa Novos",
    status: contact?.status ?? "ativo",
    stage: contact?.stage ?? "Novos",
    phone: contact?.phone ?? "+55 (11) 99999-9999",
    phoneLabel: contact?.phoneLabel ?? "WhatsApp",
    email: contact?.email ?? "paulo@email.com",
    origin: contact?.origin ?? "Instagram",
    tags: contact?.tags ?? ["Novo"],
    address: contact?.address ?? "Rua das Flores, 120 — Centro",
  };

  const closeWizard = useCallback(() => {
    setWizardOpen(false);
    setWizardStep(1);
    setTermsChecked(false);
  }, []);

  const handleWizardNext = useCallback(() => {
    if (wizardStep === 1) {
      setWizardStep(2);
    } else if (wizardStep === 2 && termsChecked) {
      setWizardStep(3);
    }
  }, [wizardStep, termsChecked]);

  const handleWizardBack = useCallback(() => {
    if (wizardStep > 1) setWizardStep((prev) => prev - 1);
  }, []);

  const handleFinish = useCallback(() => {
    closeWizard();
    setIsOpen(false);
    onFinish?.();
  }, [closeWizard, onFinish]);

  if (!isOpen) return null;

  const TabIcon: Record<TabId, React.ComponentType<{ className?: string }>> = {
    dados: Folder,
    contato: MessageSquare,
    historico: Clock,
    mais: Users,
  };

  const TabLabel: Record<TabId, string> = {
    dados: "Dados",
    contato: "Conversas",
    historico: "Histórico",
    mais: "Mais",
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={backdropTw}
        onClick={() => {
          setIsOpen(false);
          onClose?.();
        }}
      >
        <div
          className={scrimTw}
          onClick={(e) => e.stopPropagation()}
        />

        {/* Card da ficha */}
        <div
          className={cardTw}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Cabeçalho mínimo */}
          <div className={headerTw}>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-token-lg bg-brand-soft">
                <img
                  src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(c.name)}`}
                  alt="Avatar"
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <div className="flex items-baseline gap-1.5">
                  <h2 className="text-lg font-bold tracking-tight text-ink">{c.name}</h2>
                  <span className={c.status === "ativo" ? statusOnlineTw : statusOfflineTw}>
                    {c.status === "ativo" ? "Online" : "Offline"}
                  </span>
                </div>
                <p className="mt-0.5 text-xs font-medium text-ink-muted">{c.role}</p>
              </div>
            </div>

            <button
              className="rounded-full p-2 text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink-secondary"
              onClick={() => {
                setIsOpen(false);
                onClose?.();
              }}
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tabs — menu enxuto */}
          <div className={tabsTw}>
            {(["dados", "contato", "historico", "mais"] as TabId[]).map((tab) => {
              const Icon = TabIcon[tab];
              return (
                <button
                  key={tab}
                  className={activeTab === tab ? tabActiveTw : tabInactiveTw}
                  onClick={() => {
                    setActiveTab(tab);
                    setMoreOpen(false);
                  }}
                >
                  <Icon className="w-4 h-4" />
                  <span>{TabLabel[tab]}</span>
                </button>
              );
            })}
          </div>

          {/* Conteúdo da aba */}
          <div className={bodyTw}>
            {activeTab === "dados" && <DadosTab contact={c} editing={editing} />}
            {activeTab === "contato" && <ContatoTab contact={c} editing={editing} />}
            {activeTab === "historico" && <HistoricoTab contact={c} />}
            {activeTab === "mais" && <MaisTab contact={c} editing={editing} />}
          </div>

          {/* Rodapé com ação principal */}
          <div className={footerTw}>
            <button
              className={editing ? editDoneTw : editStartTw}
              onClick={() => {
                setEditing(!editing);
                if (!editing) onSave?.({ ...c });
              }}
            >
              {editing ? "Concluir edição" : "Editar"}
            </button>
            <button
              className={primaryButtonTw}
              onClick={() => setWizardOpen(true)}
            >
              Concluir ficha
            </button>
          </div>
        </div>
      </div>

      {/* Wizard de conclusão — só quando necessário */}
      {wizardOpen && (
        <div
          className={wizardTw}
          onClick={closeWizard}
        >
          <div
            className={wizardCardTw}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={wizardHeaderTw}>
              <div>
                <h3 className="text-lg font-bold text-ink">Concluir ficha</h3>
                <p className="mt-1 text-xs text-ink-muted">
                  Revise rapidamente e finalize.
                </p>
              </div>
              <button
                className="rounded-full p-2 text-ink-muted transition-colors hover:text-ink-secondary"
                onClick={closeWizard}
                title="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className={wizardBodyTw}>
              {/* Passo 1: Revisar */}
              <div className={wizardStep === 1 ? wizardStepTw : wizardStepHiddenTw}>
                <div className="mb-2 flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand text-2xs font-bold text-brand-contrast">
                    1
                  </span>
                  <span className="text-sm font-semibold text-ink-secondary">Confira os dados</span>
                </div>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between rounded-token-sm border border-line bg-surface-2 p-3">
                    <div>
                      <div className="font-medium text-ink">{c.name}</div>
                      <div className="text-xs text-ink-muted">{c.role}</div>
                    </div>
                    <span className={chipSuccessSmTw}>
                      Ativo
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-token-sm border border-line bg-surface-2 p-3">
                    <div>
                      <div className="font-medium text-ink">{c.phoneLabel}</div>
                      <div className="text-xs text-ink-muted">{c.phone}</div>
                    </div>
                    <span className="text-xs text-ink-muted">Principal</span>
                  </div>
                </div>
              </div>

              {/* Passo 2: Confirmar */}
              <div className={wizardStep === 2 ? wizardStepTw : wizardStepHiddenTw}>
                <div className="mb-2 flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand text-2xs font-bold text-brand-contrast">
                    2
                  </span>
                  <span className="text-sm font-semibold text-ink-secondary">Confirmar</span>
                </div>
                <div className="rounded-token-sm border border-warning-soft bg-warning-soft p-4">
                  <p className="text-sm text-warning">
                    Ao concluir, a ficha será salva e o atendimento seguirá para a próxima etapa.
                  </p>
                </div>
                <label
                  className="group flex cursor-pointer select-none items-center gap-2.5"
                  onClick={() => setTermsChecked(!termsChecked)}
                >
                  <input
                    type="checkbox"
                    checked={termsChecked}
                    className="rounded-sm accent-brand"
                    readOnly
                  />
                  <span className="text-sm text-ink-secondary transition-colors group-hover:text-brand">
                    Li e confirmo que as informações estão corretas.
                  </span>
                </label>
              </div>

              {/* Passo 3: Finalizado */}
              <div
                className={wizardStep === 3 ? wizardDoneTw : wizardDoneHiddenTw}
              >
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-success-soft text-success">
                  <Check className="w-7 h-7" />
                </div>
                <h3 className="mb-1 text-lg font-bold text-ink">
                  Ficha concluída
                </h3>
                <p className="mb-6 text-sm text-ink-muted">
                  Salvo com sucesso.
                </p>
              </div>
            </div>

            <div className={footerTw}>
              <button
                className={wizardStep === 1 ? wizardBackHiddenTw : wizardBackTw}
                onClick={handleWizardBack}
              >
                <ArrowLeft className="mr-1.5 w-4 h-4" /> Voltar
              </button>
              <div className="flex gap-2">
                <button
                  className={wizardStep === 3 ? primaryButtonHiddenTw : primaryButtonTw}
                  onClick={handleWizardNext}
                  disabled={wizardStep === 2 && !termsChecked}
                >
                  Próximo <ArrowRight className="ml-1.5 w-4 h-4" />
                </button>
                <button
                  className={wizardStep !== 3 ? wizardFinishHiddenTw : wizardFinishTw}
                  onClick={handleFinish}
                >
                  Finalizar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ---------- Sub-tabs de conteúdo ---------- */

function DadosTab({ contact, editing }: { contact: Contact; editing: boolean }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className={fieldTw}>
          <p className={labelTw}>
            Nome
          </p>
          <input
            type="text"
            defaultValue={contact.name}
            disabled={!editing}
            className={inputTw}
          />
        </div>
        <div className={fieldTw}>
          <p className={labelTw}>
            Etapa
          </p>
          <input
            type="text"
            defaultValue={contact.stage}
            disabled={!editing}
            className={inputTw}
          />
        </div>
      </div>
      <div className={fieldTw}>
        <p className={labelTw}>
          Endereço
        </p>
        <input
          type="text"
          defaultValue={contact.address}
          disabled={!editing}
          className={inputTw}
        />
      </div>
    </div>
  );
}

function ContatoTab({ contact, editing }: { contact: Contact; editing: boolean }) {
  return (
    <div className="space-y-4">
      <div className={fieldRowTw}>
        <div className="flex items-center gap-3">
          <div className={iconBoxTw}>
            <Phone className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-ink">{contact.phoneLabel}</p>
            <p className="truncate text-xs text-ink-muted">{contact.phone}</p>
          </div>
        </div>
        <span className={chipSuccessMdTw}>
          Ativo
        </span>
      </div>
      <div className={fieldRowSurfaceTw}>
        <div className="flex items-center gap-3">
          <div className={iconMutedTw}>
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-ink">E-mail</p>
            <p className="truncate text-xs text-ink-muted">{contact.email}</p>
          </div>
        </div>
        <button
          className="rounded-full p-1.5 text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink-secondary"
          disabled={!editing}
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
      <p className={labelTw}>
        Adicione outros canais quando precisar.
      </p>
    </div>
  );
}

function HistoricoTab({ contact }: { contact: Contact }) {
  const entries = [
    { when: "Há 2 dias", what: "Primeiro contato via Instagram", by: "Sistema" },
    { when: "Ontem", what: "Mensagem no WhatsApp respondida", by: "Atendente" },
    { when: "Hoje", what: "Ficha atualizada", by: "Você" },
  ];

  return (
    <div className="space-y-3">
      {entries.map((item, i) => (
        <div key={i} className="flex items-start gap-3 rounded-token-sm border border-line bg-surface-2 p-3">
          <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand" />
          <div className="flex-1">
            <p className="text-xs leading-relaxed text-ink">{item.what}</p>
            <div className="mt-1 flex justify-between">
              <span className="text-2xs text-ink-muted">{item.when}</span>
              <span className="text-2xs text-ink-muted">{item.by}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function MaisTab({ contact, editing }: { contact: Contact; editing: boolean }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className={fieldRowTw}>
          <div className="flex items-center gap-3">
            <div className={iconMutedTw}>
              <Folder className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-ink">Campos personalizados</p>
              <p className="text-xs text-ink-muted">Use em automações</p>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-line-strong" />
        </div>
        <div className={fieldRowTw}>
          <div className="flex items-center gap-3">
            <div className={iconMutedTw}>
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-ink">Preferências</p>
              <p className="text-xs text-ink-muted">Notificações e idioma</p>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-line-strong" />
        </div>
      </div>
      <div className={fieldRowTw}>
        <div>
          <p className="text-xs font-semibold text-ink">Tags</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {(contact.tags ?? []).map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-brand-soft bg-brand-soft px-2 py-1 text-2xs font-medium text-brand-strong"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
        <button
          className="rounded-full p-1.5 text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink-secondary"
          disabled={!editing}
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
