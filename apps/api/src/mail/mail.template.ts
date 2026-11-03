const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, (char) => ESCAPES[char]!);

export interface EmailBlock {
  title: string;
  intro: string;
  paragraphs?: string[];
  action?: { label: string; url: string };
  footnote?: string;
}

/**
 * One layout for every product e-mail: same header, same action button, plain-text fallback.
 * All interpolated text is escaped, because parts of it come from user input.
 */
export function renderEmail(block: EmailBlock): { html: string; text: string } {
  const paragraphs = block.paragraphs ?? [];
  const html = [
    '<div style="margin:0;padding:24px;background:#f7f8fc;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif">',
    '<div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e9ebf3;border-radius:16px;overflow:hidden">',
    '<div style="padding:20px 24px;border-bottom:1px solid #eef0f4"><span style="display:inline-block;width:30px;height:30px;border-radius:10px;background:#6258df;color:#fff;text-align:center;line-height:30px;font-weight:800">V</span>',
    '<strong style="margin-left:10px;font-size:15px;color:#20243a">véxora</strong>',
    '<span style="margin-left:6px;font-size:10px;letter-spacing:.14em;color:#7c8299">SUITE</span></div>',
    '<div style="padding:26px 24px">',
    `<h1 style="margin:0 0 10px;font-size:21px;line-height:1.3;color:#20243a">${escapeHtml(block.title)}</h1>`,
    `<p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#4a5068">${escapeHtml(block.intro)}</p>`,
    ...paragraphs.map(
      (paragraph) =>
        `<p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#4a5068">${escapeHtml(paragraph)}</p>`,
    ),
    block.action
      ? `<p style="margin:22px 0"><a href="${escapeHtml(block.action.url)}" style="display:inline-block;padding:12px 20px;border-radius:10px;background:#6258df;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none">${escapeHtml(block.action.label)}</a></p>`
      : "",
    block.action
      ? `<p style="margin:0;font-size:12px;line-height:1.6;color:#8b91a7;word-break:break-all">Se o botão não funcionar, copie este endereço: ${escapeHtml(block.action.url)}</p>`
      : "",
    block.footnote
      ? `<p style="margin:18px 0 0;font-size:12px;line-height:1.6;color:#8b91a7">${escapeHtml(block.footnote)}</p>`
      : "",
    "</div></div>",
    '<p style="max-width:520px;margin:14px auto 0;font-size:11px;color:#98a2b3;text-align:center">Véxora Suite · mensagem automática</p>',
    "</div>",
  ].join("");

  const text = [
    block.title,
    "",
    block.intro,
    ...paragraphs.flatMap((paragraph) => ["", paragraph]),
    ...(block.action ? ["", `${block.action.label}: ${block.action.url}`] : []),
    ...(block.footnote ? ["", block.footnote] : []),
    "",
    "Véxora Suite",
  ].join("\n");

  return { html, text };
}
