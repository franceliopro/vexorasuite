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
import "./ficha-cliente.css";

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
        className="vx-ficha-backdrop"
        onClick={() => {
          setIsOpen(false);
          onClose?.();
        }}
      >
        <div
          className="vx-ficha-scrim"
          onClick={(e) => e.stopPropagation()}
        />

        {/* Card da ficha */}
        <div
          className="vx-ficha-card"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Cabeçalho mínimo */}
          <div className="vx-ficha-header">
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
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${
                    c.status === "ativo"
                      ? "border-success-soft bg-success-soft text-success"
                      : "border-line bg-surface-3 text-ink-muted"
                  }`}>
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
          <div className="vx-ficha-tabs">
            {(["dados", "contato", "historico", "mais"] as TabId[]).map((tab) => {
              const Icon = TabIcon[tab];
              return (
                <button
                  key={tab}
                  className={`flex flex-1 flex-col items-center justify-center gap-1 px-3 py-3.5 text-xs font-medium transition-colors ${
                    activeTab === tab
                      ? "border-b-2 border-brand bg-brand-soft text-brand"
                      : "text-ink-muted hover:bg-surface-2 hover:text-ink-secondary"
                  }`}
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
          <div className="vx-ficha-body">
            {activeTab === "dados" && <DadosTab contact={c} editing={editing} />}
            {activeTab === "contato" && <ContatoTab contact={c} editing={editing} />}
            {activeTab === "historico" && <HistoricoTab contact={c} />}
            {activeTab === "mais" && <MaisTab contact={c} editing={editing} />}
          </div>

          {/* Rodapé com ação principal */}
          <div className="vx-ficha-footer">
            <button
              className={`rounded-token-sm px-4 py-2 text-sm font-semibold transition-colors ${
                editing
                  ? "bg-surface-3 text-ink hover:bg-line"
                  : "border border-line text-ink-secondary hover:bg-surface-2"
              }`}
              onClick={() => {
                setEditing(!editing);
                if (!editing) onSave?.({ ...c });
              }}
            >
              {editing ? "Concluir edição" : "Editar"}
            </button>
            <button
              className="vx-ficha-btn-primary"
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
          className="fixed inset-0 z-wizard flex items-center justify-center bg-overlay-soft p-4 backdrop-blur-sm"
          onClick={closeWizard}
        >
          <div
            className="relative flex max-h-wizard w-full max-w-sm flex-col overflow-hidden rounded-token-xl border border-line bg-surface shadow-token-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-line p-5">
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

            <div className="p-6 flex-1 overflow-y-auto">
              {/* Passo 1: Revisar */}
              <div className={`space-y-4 ${wizardStep === 1 ? "" : "hidden"}`}>
                <div className="flex items-center gap-2 mb-2">
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
                    <span className="vx-ficha-chip-success px-2 py-1">
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
              <div className={`space-y-4 ${wizardStep === 2 ? "" : "hidden"}`}>
                <div className="flex items-center gap-2 mb-2">
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
                  className="flex items-center gap-2.5 cursor-pointer select-none group"
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
                className={`flex flex-col items-center justify-center py-12 text-center ${wizardStep === 3 ? "" : "hidden"}`}
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

            <div className="vx-ficha-footer">
              <button
                className={`rounded-token-sm border border-line px-3 py-2 text-sm font-semibold text-ink-secondary transition-colors hover:bg-surface-2 ${
                  wizardStep === 1 ? "hidden" : ""
                }`}
                onClick={handleWizardBack}
              >
                <ArrowLeft className="w-4 h-4 mr-1.5" /> Voltar
              </button>
              <div className="flex gap-2">
                <button
                  className={`vx-ficha-btn-primary ${
                    wizardStep === 3 ? "hidden" : ""
                  }`}
                  onClick={handleWizardNext}
                  disabled={wizardStep === 2 && !termsChecked}
                >
                  Próximo <ArrowRight className="w-4 h-4 ml-1.5" />
                </button>
                <button
                  className={`inline-flex items-center justify-center rounded-token-sm bg-ink px-3 py-2 text-sm font-semibold text-brand-contrast transition-all hover:bg-ink-secondary active:scale-95 ${
                    wizardStep !== 3 ? "hidden" : ""
                  }`}
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="vx-ficha-field">
          <p className="vx-ficha-label">
            Nome
          </p>
          <input
            type="text"
            defaultValue={contact.name}
            disabled={!editing}
            className="vx-ficha-input"
          />
        </div>
        <div className="vx-ficha-field">
          <p className="vx-ficha-label">
            Etapa
          </p>
          <input
            type="text"
            defaultValue={contact.stage}
            disabled={!editing}
            className="vx-ficha-input"
          />
        </div>
      </div>
      <div className="vx-ficha-field">
        <p className="vx-ficha-label">
          Endereço
        </p>
        <input
          type="text"
          defaultValue={contact.address}
          disabled={!editing}
          className="vx-ficha-input"
        />
      </div>
    </div>
  );
}

function ContatoTab({ contact, editing }: { contact: Contact; editing: boolean }) {
  return (
    <div className="space-y-4">
      <div className="vx-ficha-field flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="vx-ficha-icon-box">
            <Phone className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-ink">{contact.phoneLabel}</p>
            <p className="truncate text-xs text-ink-muted">{contact.phone}</p>
          </div>
        </div>
        <span className="vx-ficha-chip-success px-2.5 py-1">
          Ativo
        </span>
      </div>
      <div className="vx-ficha-field flex items-center justify-between bg-surface">
        <div className="flex items-center gap-3">
          <div className="vx-ficha-icon-muted">
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
      <p className="vx-ficha-label">
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
            <div className="flex justify-between mt-1">
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="vx-ficha-field flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="vx-ficha-icon-muted">
              <Folder className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-ink">Campos personalizados</p>
              <p className="text-xs text-ink-muted">Use em automações</p>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-line-strong" />
        </div>
        <div className="vx-ficha-field flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="vx-ficha-icon-muted">
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
      <div className="vx-ficha-field flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-ink">Tags</p>
          <div className="flex flex-wrap gap-1.5 mt-1">
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
