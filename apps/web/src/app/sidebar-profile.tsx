"use client";
import { useEffect, useRef, useState } from "react";
import { ProfilePhotoEditor } from "./profile-photo-editor";

const primaryTw = "inline-flex min-h-control items-center justify-center gap-2 rounded-token-sm bg-blue-600 px-4 text-body font-bold text-blue-50 shadow-token-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60";
const secondaryTw = "inline-flex min-h-control items-center justify-center gap-2 rounded-token-sm border border-line bg-surface-2 px-4 text-body font-bold text-ink shadow-token-sm transition-colors hover:border-line-strong hover:bg-hover disabled:cursor-not-allowed disabled:opacity-60";
const textButtonTw = "inline-flex min-h-8 items-center justify-center gap-2 rounded-token-sm px-1.5 text-body font-bold text-blue-600 transition-colors hover:bg-surface hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-60";
const menuTw = "group relative w-full";
const rowTw = "flex w-full cursor-pointer list-none items-center gap-profile-gap overflow-hidden rounded-token-sm border border-transparent px-profile-row-x py-profile-row-y text-sidebar-text hover:border-sidebar-line hover:bg-sidebar-on group-open:border-sidebar-line group-open:bg-sidebar-on";
const avatarTw = "relative grid size-profile-avatar shrink-0 place-items-center overflow-hidden rounded-full bg-brand-soft text-profile-avatar font-bold text-sidebar-text";
const avatarImageTw = "size-full object-cover";
const copyTw = "flex min-w-0 flex-col gap-profile-copy-gap overflow-hidden";
const nameTw = "truncate text-profile-name font-semibold text-sidebar-text";
const emailTw = "max-w-full truncate text-profile-email text-sidebar-muted";
const popoverTw = "absolute z-profile-popover grid gap-token bg-surface p-pad text-ink shadow-token ov-tablet:fixed ov-tablet:inset-x-profile-popover-inset ov-tablet:bottom-profile-popover-bottom ov-tablet:w-auto";
const headingTw = "text-h3 font-bold text-ink";
const formTw = "grid gap-token";
const fieldTw = "grid gap-1.5 text-body font-semibold text-ink";
const statusTw = "text-body text-ink-secondary";
const alertTw = "text-body text-danger";

export function SidebarProfile({
  user,
  canManage,
  onUpdated,
  onTeam,
}: {
  user: { name: string; email: string; avatarUrl?: string | null };
  canManage: boolean;
  onUpdated: () => Promise<void>;
  onTeam: () => void;
}) {
  const [profile, setProfile] = useState<any>(null),
    [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState(""),
    [notice, setNotice] = useState("");
  const menuRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (event: MouseEvent) => { if(menuRef.current?.open && !menuRef.current.contains(event.target as Node)) menuRef.current.removeAttribute("open"); };
    const escape = (event: KeyboardEvent) => { if(event.key==="Escape") menuRef.current?.removeAttribute("open"); };
    document.addEventListener("mousedown",close); document.addEventListener("keydown",escape);
    return () => { document.removeEventListener("mousedown",close); document.removeEventListener("keydown",escape); };
  }, []);
  async function loadProfile() {
    setLoading(true);
    setLoadError("");
    try {
      const response = await fetch("/api/backend/profile", { cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.message || "Não foi possível carregar o perfil.");
      setProfile(data);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Não foi possível carregar o perfil.");
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void loadProfile(); }, []);
  return (
    <details ref={menuRef} className={menuTw}>
      <summary className={rowTw} title="Meu perfil e equipe">
        <span className={avatarTw}>
          {user.avatarUrl ? <img className={avatarImageTw} src={user.avatarUrl} alt="Minha foto" /> : user.name.slice(0, 2).toUpperCase()}
          <ProfilePhotoEditor compact onUpdated={onUpdated} />
        </span>
        <span className={copyTw}>
          <strong className={nameTw}>{user.name}</strong>
          <small className={emailTw}>{user.email}</small>
        </span>
      </summary>
      <div className={popoverTw}>
        <h2 className={headingTw}>Meu perfil</h2>
        {loading && <p role="status" className={statusTw}>Carregando perfil...</p>}
        {!loading && loadError && <div className={formTw}><p role="alert" className={alertTw}>{loadError}</p><button type="button" className={secondaryTw} onClick={() => void loadProfile()}>Tentar novamente</button></div>}
        {!loading && !loadError && profile && (
          <form
            className={formTw}
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                const r = await fetch("/api/backend/profile", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify(profile),
                });
                const d = await r.json();
                if (!r.ok) throw Error(d.message);
                await onUpdated();
                setNotice("Perfil atualizado.");
              } catch (e) {
                setNotice(
                  e instanceof Error ? e.message : "Não foi possível salvar.",
                );
              }
            }}
          >
            <label className={fieldTw}>
              Nome
              <input
                required
                maxLength={160}
                value={profile.name || ""}
                onChange={(e) =>
                  setProfile((v: any) => ({ ...v, name: e.target.value }))
                }
              />
            </label>
            <label className={fieldTw}>
              E-mail
              <input value={user.email} readOnly />
            </label>
            <button className={primaryTw}>Salvar perfil</button>
          </form>
        )}
        {canManage && (
          <button
            type="button"
            className={textButtonTw}
            onClick={(e) => {
              e.currentTarget.closest("details")?.removeAttribute("open");
              onTeam();
            }}
          >
            Gerenciar atendentes e setores
          </button>
        )}
        {notice && <p role="status" className={statusTw}>{notice}</p>}
      </div>
    </details>
  );
}
