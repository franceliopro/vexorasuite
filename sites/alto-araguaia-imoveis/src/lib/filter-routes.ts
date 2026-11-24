export type ListingCategory = "" | "urbano" | "rural";

const routes: Record<ListingCategory, string> = {
  "": "/imoveis/#imoveis",
  urbano: "/imoveis-urbanos/#imoveis",
  rural: "/imoveis-rurais/#imoveis",
};

const pageParams: Record<ListingCategory, string> = {
  "": "inicio",
  urbano: "urbano",
  rural: "rural",
};

export function normalizeCategory(value: string | null | undefined): ListingCategory {
  return value === "urbano" || value === "rural" ? value : "";
}

/**
 * Mantém action, parâmetro `p` e `data-category` alinhados à categoria
 * selecionada. Sem isso, trocar "Categoria" em /imoveis-urbanos/ ou
 * /imoveis-rurais/ enviava o filtro para a página errada e não retornava
 * nenhum imóvel.
 */
export function syncCategoryRoute(form: HTMLFormElement | null): void {
  if (!form) return;

  const select = form.querySelector<HTMLSelectElement>('select[name="category"]');
  const category = normalizeCategory(select?.value);
  const hidden = form.querySelector<HTMLInputElement>('input[name="p"]');

  if (hidden) hidden.value = pageParams[category];
  form.setAttribute("action", routes[category]);
  form.dataset.category = category;
}
