import { mergeProfileFields } from "./contacts.controller";

describe("mergeProfileFields", () => {
  it("exposes active CRM catalog fields in the contact profile", () => {
    expect(mergeProfileFields(
      [{ id: "legacy", name: "Campo antigo", key: "legacy", type: "TEXT", options: [] }],
      [
        { id: "customer_type", label: "Tipo de cliente", type: "SELECT", options: ["Novo", "Ativo"], enabled: true },
        { id: "consent", label: "Consentimento", type: "BOOLEAN", options: [], enabled: true },
        { id: "disabled", label: "Não mostrar", type: "TEXT", options: [], enabled: false },
      ],
    )).toEqual([
      { id: "legacy", name: "Campo antigo", key: "legacy", type: "TEXT", options: [] },
      { id: "catalog-customer_type", name: "Tipo de cliente", key: "customer_type", type: "SELECT", options: ["Novo", "Ativo"], source: "custom-fields" },
      { id: "catalog-consent", name: "Consentimento", key: "consent", type: "CHECKBOX", options: [], source: "custom-fields" },
    ]);
  });

  it("keeps legacy field definitions authoritative when keys collide", () => {
    expect(mergeProfileFields(
      [{ id: "legacy", name: "Nome interno", key: "customer_type", type: "TEXT", options: [] }],
      [{ id: "customer_type", label: "Tipo", type: "SELECT", options: ["Ativo"], enabled: true }],
    )).toHaveLength(1);
  });
});
