import { emailThreadKeys } from "./email-mailbox.service";

describe("emailThreadKeys", () => {
  it("normalizes angles, folded spaces and case", () => {
    expect(emailThreadKeys({ messageId: "  <  ABC\\r\\n\\t@Example.COM >  " }, "email:mailbox:1")).toEqual([
      "abc @example.com",
      "provider:email:mailbox:1",
    ]);
  });

  it("prioritizes the current Message-ID, then reply and references", () => {
    expect(emailThreadKeys({
      messageId: "<Current@EXAMPLE.com>",
      inReplyTo: "<Parent@Example.com>",
      references: ["<Root@Example.com>", "<Parent@Example.com>"],
    }, "provider-id")).toEqual([
      "current@example.com",
      "parent@example.com",
      "root@example.com",
      "provider:provider-id",
    ]);
  });

  it("deduplicates equivalent header values deterministically", () => {
    expect(emailThreadKeys({
      messageId: "<Same@Example.com>",
      inReplyTo: " same@example.com ",
      references: ["<SAME@example.com>"],
    }, "provider-id")).toEqual([
      "same@example.com",
      "provider:provider-id",
    ]);
  });

  it("uses the provider identity instead of the subject when headers are absent", () => {
    expect(emailThreadKeys({}, "email:mailbox:7:uid:42")).toEqual(["provider:email:mailbox:7:uid:42"]);
    expect(emailThreadKeys({}, "email:mailbox:7:uid:43")).not.toEqual(emailThreadKeys({}, "email:mailbox:7:uid:42"));
  });
});
