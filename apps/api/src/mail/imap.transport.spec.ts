import { jest as jestGlobals } from "@jest/globals";
const jest = jestGlobals as any;

const ImapFlow = jest.fn();
jest.unstable_mockModule("imapflow", () => ({
  ImapFlow,
  default: { ImapFlow },
}));

let ImapMailTransport: typeof import("./imap.transport").ImapMailTransport;

const ImapFlowMock = ImapFlow as unknown as jest.Mock;

beforeAll(async () => {
  ({ ImapMailTransport } = await import("./imap.transport"));
});

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
