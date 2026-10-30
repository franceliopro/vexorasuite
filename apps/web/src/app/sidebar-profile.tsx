"use client";
import { useEffect, useRef, useState } from "react";
import { ProfilePhotoEditor } from "./profile-photo-editor";
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
    [notice, setNotice] = useState("");
  const menuRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (event: MouseEvent) => { if(menuRef.current?.open && !menuRef.current.contains(event.target as Node)) menuRef.current.removeAttribute("open"); };
    const escape = (event: KeyboardEvent) => { if(event.key==="Escape") menuRef.current?.removeAttribute("open"); };
    document.addEventListener("mousedown",close); document.addEventListener("keydown",escape);
    return () => { document.removeEventListener("mousedown",close); document.removeEventListener("keydown",escape); };
  }, []);
  useEffect(() => {
    fetch("/api/backend/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then(setProfile)
      .catch(() => {});
  }, []);
  return (
    <details ref={menuRef} className="sidebar-profile-menu">
      <summary className="profile-row" title="Meu perfil e equipe">
        <span className="profile-avatar">
          {user.avatarUrl ? <img src={user.avatarUrl} alt="Minha foto" /> : user.name.slice(0, 2).toUpperCase()}
          <ProfilePhotoEditor compact onUpdated={onUpdated} />
        </span>
        <span className="profile-copy">
          <strong>{user.name}</strong>
          <small>{user.email}</small>
        </span>
      </summary>
      <div className="sidebar-profile-popover">
        <h2>Meu perfil</h2>
        {profile && (
          <form
            className="ai-admin-fields"
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
            <label>
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
            <label>
              E-mail
              <input value={user.email} readOnly />
            </label>
            
            <button className="primary-button">Salvar perfil</button>
          </form>
        )}
        {canManage && (
          <button
            type="button"
            className="text-button"
            onClick={(e) => {
              e.currentTarget.closest("details")?.removeAttribute("open");
              onTeam();
            }}
          >
            Gerenciar atendentes e setores
          </button>
        )}
        {notice && <p role="status">{notice}</p>}
      </div>
    </details>
  );
}
