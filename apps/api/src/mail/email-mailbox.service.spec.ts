import { jest as jestGlobals } from "@jest/globals";
const jest = jestGlobals as any;

const ImapFlow = jest.fn();
jest.unstable_mockModule("imapflow", () => ({ ImapFlow, default: { ImapFlow } }));
jest.unstable_mockModule("../communications/security", () => ({ mailHost: jest.fn().mockResolvedValue("203.0.113.10") }));

let EmailMailboxService: typeof import("./email-mailbox.service").EmailMailboxService;
let isValidEmailAddress: typeof import("./email-mailbox.service").isValidEmailAddress;
const ImapFlowMock = ImapFlow as unknown as jest.Mock;
beforeAll(async () => {
  ({ EmailMailboxService, isValidEmailAddress } = await import("./email-mailbox.service"));
});

describe("EmailMailboxService IMAP timeouts", () => {
  const mailbox = {
    id: "mailbox-1",
    tenantId: "tenant-1",
    address: "inbox@example.com",
    imapHost: "imap.example.com",
    imapPort: 993,
    imapSecure: true,
    imapUser: "inbox@example.com",
    imapPasswordEncrypted: "encrypted",
    imapMailbox: "INBOX",
    status: "CONNECTED",
    syncUidValidity: 1,
    syncLastUid: 0,
    smtpHost: null,
    smtpPort: null,
    smtpSecure: null,
    smtpUser: null,
    smtpPasswordEncrypted: null,
    smtpFrom: null,
    smtpFromName: null,
    channelConnectionId: "channel-1",
  };

  const buildClient = () => ({
    connect: jest.fn().mockResolvedValue(undefined),
    mailboxOpen: jest.fn().mockResolvedValue({ exists: 0 }),
    getMailboxLock: jest.fn().mockResolvedValue({ release: jest.fn() }),
    fetch: jest.fn().mockReturnValue((async function* () {})()),
    mailbox: { uidValidity: 1 },
    logout: jest.fn().mockResolvedValue(undefined),
    close: jest.fn(),
  });

  beforeEach(() => {
    ImapFlowMock.mockReset();
    ImapFlowMock.mockImplementation(() => buildClient());
  });

  it("bounds mailbox verification connections and sockets", async () => {
    const prisma = {
      emailMailbox: {
        findFirst: jest.fn().mockResolvedValue(mailbox),
        update: jest.fn().mockResolvedValue({}),
      },
      channelConnection: { update: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn().mockResolvedValue([]),
    };
    const events = { publish: jest.fn() };
    const service = new EmailMailboxService(prisma as never, events as never);
    jest.spyOn(service as any, "decrypt" as any).mockReturnValue("password");

    await service.verify("tenant-1", "mailbox-1");

    expect(ImapFlowMock).toHaveBeenCalledWith(
      expect.objectContaining({
        connectionTimeout: 10_000,
        socketTimeout: 20_000,
      }),
    );
  });

  it("bounds scheduled mailbox synchronization connections and sockets", async () => {
    const prisma = {
      emailMailbox: {
        findFirst: jest.fn().mockResolvedValue(mailbox),
        update: jest.fn().mockResolvedValue({}),
      },
      channelConnection: { update: jest.fn().mockResolvedValue({}) },
      message: { findFirst: jest.fn() },
      $transaction: jest.fn().mockResolvedValue([]),
    };
    const events = { publish: jest.fn() };
    const service = new EmailMailboxService(prisma as never, events as never);
    jest.spyOn(service as any, "decrypt" as any).mockReturnValue("password");

    await service.sync("tenant-1", "mailbox-1");

    expect(ImapFlowMock).toHaveBeenCalledWith(
      expect.objectContaining({
        connectionTimeout: 10_000,
        socketTimeout: 20_000,
      }),
    );
  });
});


describe("email address validation", () => {
  it("rejects whitespace and accepts a normal mailbox address", () => {
    expect(isValidEmailAddress("finance inbox@example.com")).toBe(false);
    expect(isValidEmailAddress("finance\t@example.com")).toBe(false);
    expect(isValidEmailAddress("finance@example.com")).toBe(true);
  });
});
