import { jest as jestGlobals } from "@jest/globals";
const jest = jestGlobals as any;
import { createCipheriv, createHash, randomBytes } from "node:crypto";

const mockSendNotification = jest.fn().mockResolvedValue({});
jest.unstable_mockModule("web-push", () => ({
  default: { generateVAPIDKeys: jest.fn(), sendNotification: mockSendNotification },
  generateVAPIDKeys: jest.fn(),
  sendNotification: mockSendNotification,
}));

let PushService: typeof import("./push.service").PushService;
let validPushEndpoint: typeof import("./push.service").validPushEndpoint;
let validPushSubscription: typeof import("./push.service").validPushSubscription;

beforeAll(async () => {
  ({ PushService, validPushEndpoint, validPushSubscription } = await import("./push.service"));
});

function encryptedKey() {
  process.env.INTEGRATION_ENCRYPTION_KEY = 'notification-preferences-test-key';
  const key = createHash('sha256').update(process.env.INTEGRATION_ENCRYPTION_KEY).digest();
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv);
  const bytes = Buffer.concat([cipher.update('test-private-key', 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), bytes].map(value => value.toString('base64url')).join('.');
}

function notificationDb(events: string[] | null) {
  const subscription = { id: 'subscription', tenantId: 'tenant-a', userId: 'user-a', endpoint: 'https://fcm.googleapis.com/fcm/send/test', p256dh: 'A'.repeat(87), auth: 'B'.repeat(22) };
  return {
    conversation: { findFirst: jest.fn().mockResolvedValue({ assigneeId: 'user-a', departmentId: null, handlingMode: 'HUMAN' }) },
    pushConfiguration: { findUnique: jest.fn().mockResolvedValue({ privateKeyEncrypted: encryptedKey(), publicKey: 'test-public-key' }) },
    tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ integrations: {} }) },
    membership: { findMany: jest.fn().mockResolvedValue([{ userId: 'user-a', role: 'ADMIN', modules: [], deniedModules: [] }]) },
    departmentMember: { findMany: jest.fn().mockResolvedValue([]) },
    userNotificationPreference: { findMany: jest.fn().mockResolvedValue(events === null ? [] : [{ userId: 'user-a', events }]) },
    pushSubscription: { findMany: jest.fn().mockResolvedValue([subscription]), deleteMany: jest.fn() },
  };
}

beforeEach(() => { mockSendNotification.mockReset().mockResolvedValue({}) });

describe('push notification privacy and scope', () => {
  it('rejects internal addresses and lookalike push hosts', () => { expect(validPushEndpoint('https://fcm.googleapis.com/fcm/send/test')).toBe(true); expect(validPushEndpoint('https://web.push.apple.com/test')).toBe(true); for (const endpoint of ['http://fcm.googleapis.com/x', 'https://localhost/x', 'https://fcm.googleapis.com.evil.test/x', 'https://user:pass@fcm.googleapis.com/x', 'https://fcm.googleapis.com:8443/x']) expect(validPushEndpoint(endpoint)).toBe(false); expect(validPushSubscription({ endpoint: 'https://fcm.googleapis.com/test', keys: { p256dh: 'bad', auth: 'bad' } })).toBe(false) });
  it('removes only subscriptions of the authenticated tenant and user', async () => { const db: any = { pushSubscription: { deleteMany: jest.fn() } }; await new PushService(db, {} as any).unsubscribe({ user: { tenantId: 'tenant-a', sub: 'user-a' } } as any, 'https://fcm.googleapis.com/test'); expect(db.pushSubscription.deleteMany.mock.calls[0][0].where).toEqual(expect.objectContaining({ tenantId: 'tenant-a', userId: 'user-a' })) });
  it('never loads subscriptions for a conversation outside the tenant', async () => { const db: any = { conversation: { findFirst: jest.fn().mockResolvedValue(null) }, pushSubscription: { findMany: jest.fn() } }; await new PushService(db, {} as any).notify('tenant-a', 'conversation-b'); expect(db.conversation.findFirst.mock.calls[0][0].where.tenantId).toBe('tenant-a'); expect(db.pushSubscription.findMany).not.toHaveBeenCalled() });
  it('does not notify inactive accounts or someone outside the assigned queue', async () => { const db: any = { conversation: { findFirst: jest.fn().mockResolvedValue({ assigneeId: 'removed-user', departmentId: null, handlingMode: 'HUMAN' }) }, pushConfiguration: { findUnique: jest.fn().mockResolvedValue({}) }, tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ integrations: {} }) }, departmentMember: { findMany: jest.fn().mockResolvedValue([]) }, membership: { findMany: jest.fn().mockResolvedValue([{ userId: 'other-user', role: 'ADMIN', modules: [], deniedModules: [] }]) }, userNotificationPreference: { findMany: jest.fn().mockResolvedValue([]) }, pushSubscription: { findMany: jest.fn() } }; await new PushService(db, {} as any).notify('tenant-a', 'conversation-a'); expect(db.membership.findMany.mock.calls[0][0].where).toEqual(expect.objectContaining({ tenant: { status: 'ACTIVE' }, user: { isActive: true, mustChangePassword: false } })); expect(db.pushSubscription.findMany).not.toHaveBeenCalled() });
  it('keeps existing message push behavior when there is no stored preference', async () => { const db: any = notificationDb(null); await new PushService(db, {} as any).notify('tenant-a', 'conversation-a'); expect(db.userNotificationPreference.findMany.mock.calls[0][0].where).toEqual({ tenantId: 'tenant-a', userId: { in: ['user-a'] } }); expect(db.pushSubscription.findMany).toHaveBeenCalled(); expect(mockSendNotification).toHaveBeenCalledTimes(1) });
  it('does not load subscribers when message notifications are opted out', async () => { const db: any = notificationDb(['MENTION']); await new PushService(db, {} as any).notify('tenant-a', 'conversation-a'); expect(db.pushSubscription.findMany).not.toHaveBeenCalled(); expect(mockSendNotification).not.toHaveBeenCalled() });
  it('still sends an assignment that the attendant opted into', async () => { const db: any = notificationDb(['CONVERSATION_ASSIGNED_TO_ME']); await new PushService(db, {} as any).notify('tenant-a', 'conversation-a', true); expect(db.pushSubscription.findMany).toHaveBeenCalled(); expect(mockSendNotification).toHaveBeenCalledTimes(1) });
  it('does not send an assignment the attendant opted out of', async () => { const db: any = notificationDb(['MENTION']); await new PushService(db, {} as any).notify('tenant-a', 'conversation-a', true); expect(db.pushSubscription.findMany).not.toHaveBeenCalled(); expect(mockSendNotification).not.toHaveBeenCalled() });
});

describe('silent bot handling', () => {
  it.each([{ handlingMode: 'BOT', assigneeId: null, departmentId: 'finance-link' }, { handlingMode: 'HUMAN', assigneeId: null, departmentId: null }])('does not load subscribers before human assignment', async conversation => {
    const db: any = { conversation: { findFirst: jest.fn().mockResolvedValue(conversation) }, pushConfiguration: { findUnique: jest.fn() } };
    await new PushService(db, {} as any).notify('tenant', 'conversation'); expect(db.pushConfiguration.findUnique).not.toHaveBeenCalled();
  });
});
