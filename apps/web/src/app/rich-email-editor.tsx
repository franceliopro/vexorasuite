"use client";
import { useEffect, useRef, useState } from "react";
export function RichEmailEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (html: string) => void;
}) {
  const editor = useRef<HTMLDivElement>(null),
    [source, setSource] = useState(false),
    [image, setImage] = useState(""),
    [preview, setPreview] = useState(""),
    [notice, setNotice] = useState("");
  useEffect(() => {
    if (editor.current && document.activeElement !== editor.current)
      editor.current.innerHTML = value;
  }, [value, source]);
  function command(name: string, arg?: string) {
    editor.current?.focus();
    document.execCommand(name, false, arg);
    if (editor.current) onChange(editor.current.innerHTML);
  }
  async function showPreview() {
    try {
      const r = await fetch("/api/backend/mail/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ html: value }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.message || "Não foi possível visualizar.");
      setPreview(d.html);
      setNotice("");
    } catch (e) {
      setNotice(
        e instanceof Error ? e.message : "Não foi possível visualizar.",
      );
    }
  }
  return (
    <div className="email-editor">
      <div className="editor-toolbar">
        <button
          type="button"
          aria-pressed={!source}
          onClick={async () => {
            try {
              const r = await fetch("/api/backend/mail/preview", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ html: value }),
              });
              const d = await r.json();
              if (!r.ok) throw Error();
              onChange(d.html);
              setSource(false);
            } catch {
              setNotice("Revise o HTML antes de abrir o editor visual.");
            }
          }}
        >
          Visual
        </button>
        <button
          type="button"
          aria-pressed={source}
          onClick={() => setSource(true)}
        >
          HTML e CSS
        </button>
        <button type="button" onClick={() => void showPreview()}>
          Pré-visualizar
        </button>
      </div>
      {source ? (
        <>
          <label>
            HTML do cartão
            <textarea
              rows={14}
              maxLength={150000}
              value={value}
              onChange={(e) => onChange(e.target.value)}
            />
          </label>
          <small>
            Use CSS no atributo style. Imagens devem ter URL HTTPS. Scripts não
            são executados em e-mails.
          </small>
        </>
      ) : (
        <>
          <div className="editor-toolbar" aria-label="Formatar cartão">
            {[
              ["bold", "Negrito"],
              ["italic", "Itálico"],
              ["underline", "Sublinhado"],
              ["insertUnorderedList", "Lista"],
              ["justifyCenter", "Centralizar"],
            ].map(([name, label]) => (
              <button
                type="button"
                key={name}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => command(name!)}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => command("formatBlock", "h2")}
            >
              Título
            </button>
          </div>
          <div
            ref={editor}
            className="email-rich-content"
            role="textbox"
            aria-label="Conteúdo do cartão"
            aria-multiline="true"
            contentEditable
            suppressContentEditableWarning
            onPaste={(e) => {
              e.preventDefault();
              command("insertText", e.clipboardData.getData("text/plain"));
            }}
            onInput={(e) => onChange(e.currentTarget.innerHTML)}
          />
          <div className="editor-image">
            <label>
              Imagem · URL HTTPS
              <input
                type="url"
                value={image}
                onChange={(e) => setImage(e.target.value)}
                placeholder="https://…"
              />
            </label>
            <button
              type="button"
              onClick={() => {
                try {
                  if (new URL(image).protocol !== "https:") throw Error();
                  command("insertImage", image);
                  setImage("");
                } catch {
                  setNotice("Use uma URL HTTPS para a imagem.");
                }
              }}
            >
              Inserir imagem
            </button>
          </div>
        </>
      )}
      {preview && (
        <section>
          <div className="workspace-section-heading">
            <h3>Prévia do e-mail</h3>
            <button type="button" onClick={() => setPreview("")}>
              Fechar prévia
            </button>
          </div>
          <iframe
            title="Prévia do cartão"
            sandbox=""
            referrerPolicy="no-referrer"
            srcDoc={
              "<!doctype html><meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; img-src https:; style-src 'unsafe-inline'\"><body>" +
              preview +
              "</body>"
            }
          />
        </section>
      )}
      {notice && <p role="status">{notice}</p>}
    </div>
  );
}
