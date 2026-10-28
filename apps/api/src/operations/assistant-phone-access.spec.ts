import { isAuthorizedAssistantPhone, normalizeAssistantPhone } from "./assistant-phone-access";

describe("personal assistant phone access", () => {
  it("normalizes international phone formatting", () => {
    expect(normalizeAssistantPhone("+55 (11) 99999-9999")).toBe("5511999999999");
  });

  it("authorizes any explicitly configured number", () => {
    expect(isAuthorizedAssistantPhone("5511999999999@c.us", ["+55 11 99999-9999", "+55 21 98888-8888"])).toBe(true);
    expect(isAuthorizedAssistantPhone("+55 21 98888-8888", ["5511999999999", "+55 (21) 98888-8888"])).toBe(true);
  });

  it("denies numbers when the list is empty or the number is not listed", () => {
    expect(isAuthorizedAssistantPhone("+55 11 99999-9999", [])).toBe(false);
    expect(isAuthorizedAssistantPhone("+55 11 99999-9999", ["+55 21 98888-8888"])).toBe(false);
  });

  it("rejects malformed numbers", () => {
    expect(normalizeAssistantPhone("123")).toBe("");
    expect(isAuthorizedAssistantPhone("abc", ["+55 11 99999-9999"])).toBe(false);
  });
});
