jest.mock("imapflow", () => ({ ImapFlow: jest.fn() }));

import { ImapFlow } from "imapflow";
import { ImapMailTransport } from "./imap.transport";

const ImapFlowMock = ImapFlow as unknown as jest.Mock;

describe("ImapMailTransport timeouts", () => {
  beforeEach(() => {
    ImapFlowMock.mockReset();
    ImapFlowMock.mockImplementation(() => ({
      connect: jest.fn().mockResolvedValue(undefined),
      mailboxOpen: jest.fn().mockResolvedValue({ exists: 0 }),
      logout: jest.fn().mockResolvedValue(undefined),
      close: jest.fn(),
    }));
  });

  it("passes explicit connection and socket timeouts to ImapFlow", async () => {
    const transport = new ImapMailTransport({
      mode: "imap",
      host: "imap.example.com",
      port: 993,
      secure: true,
      user: "inbox@example.com",
      password: "password",
      mailbox: "INBOX",
      missing: [],
      blank: [],
      warnings: [],
    });

    await transport.verify();

    expect(ImapFlowMock).toHaveBeenCalledWith(
      expect.objectContaining({
        connectionTimeout: 10_000,
        socketTimeout: 20_000,
      }),
    );
  });
});
