jest.mock("imapflow", () => ({ ImapFlow: jest.fn() }));
jest.mock("../communications/security", () => ({ mailHost: jest.fn().mockResolvedValue("203.0.113.10") }));

import { ImapFlow } from "imapflow";
import { EmailMailboxService } from "./email-mailbox.service";

const ImapFlowMock = ImapFlow as unknown as jest.Mock;

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
    jest.spyOn(service as never, "decrypt" as never).mockReturnValue("password");

    await service.sync("tenant-1", "mailbox-1");

    expect(ImapFlowMock).toHaveBeenCalledWith(
      expect.objectContaining({
        connectionTimeout: 10_000,
        socketTimeout: 20_000,
      }),
    );
  });
});
