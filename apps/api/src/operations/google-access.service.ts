import { BadGatewayException, BadRequestException, ForbiddenException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
export type GoogleService = 'calendar' | 'drive';
const scopes: Record<GoogleService, string[]> = {
  calendar: ['https://www.googleapis.com/auth/calendar.events','https://www.googleapis.com/auth/calendar'],
  drive: ['https://www.googleapis.com/auth/drive.file','https://www.googleapis.com/auth/drive.readonly','https://www.googleapis.com/auth/drive'],
};
@Injectable()
export class GoogleAccessService {
  constructor(private readonly prisma: PrismaService) {}
  private key() {
    const key = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY || '';
    if (!/^[a-f0-9]{64}$/i.test(key)) throw new ServiceUnavailableException('Criptografia Google não configurada.');
    return Buffer.from(key, 'hex');
  }
  encrypt(value: string) {
    const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', this.key(), iv);
    const bytes = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return [iv, cipher.getAuthTag(), bytes].map(b => b.toString('base64url')).join('.');
  }
  decrypt(value: string) {
    try {
      const parts = value.split('.');
      if (parts.length !== 3) throw new Error();
      const decipher = createDecipheriv('aes-256-gcm', this.key(), Buffer.from(parts[0]!, 'base64url'));
      decipher.setAuthTag(Buffer.from(parts[1]!, 'base64url'));
      return Buffer.concat([decipher.update(Buffer.from(parts[2]!, 'base64url')), decipher.final()]).toString('utf8');
    } catch { throw new BadRequestException('Credencial Google inválida. Reconecte a conta.'); }
  }
  assertScope(account: { scopes: string; disabledServices: string[] } | null, service: GoogleService) {
    if (!account || account.disabledServices.includes(service) || !account.scopes.split(' ').some(s => scopes[service].includes(s))) throw new ForbiddenException('Conta Google sem autorização para este serviço nesta empresa.');
  }
  async token(tenantId: string, accountId: string, service: GoogleService) {
    return this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM google_connections WHERE id = ${accountId}::uuid AND tenant_id = ${tenantId}::uuid FOR UPDATE`;
      const account = await tx.googleConnection.findFirst({ where: { id: accountId, tenantId } });
      this.assertScope(account, service);
      if (!account) throw new ForbiddenException();
      if (account.expiresAt.getTime() > Date.now() + 60000) return this.decrypt(account.accessTokenEncrypted);
      if (!account.refreshTokenEncrypted) throw new BadRequestException('Reconecte a conta Google para renovar a autorização.');
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID || '', client_secret: process.env.GOOGLE_CLIENT_SECRET || '', refresh_token: this.decrypt(account.refreshTokenEncrypted), grant_type: 'refresh_token' }),
        signal: AbortSignal.timeout(12000), redirect: 'error',
      });
      if (!response.ok) throw new BadGatewayException('Não foi possível renovar a autorização Google. Reconecte a conta.');
      const token = await response.json() as { access_token?: string; expires_in?: number; refresh_token?: string };
      if (!token.access_token) throw new BadGatewayException('Google não retornou uma autorização válida.');
      await tx.googleConnection.update({ where: { id: account.id }, data: {
        accessTokenEncrypted: this.encrypt(token.access_token), expiresAt: new Date(Date.now() + Math.min(Math.max(Number(token.expires_in) || 3600, 60), 86400) * 1000),
        ...(token.refresh_token ? { refreshTokenEncrypted: this.encrypt(token.refresh_token) } : {}),
      } });
      return token.access_token;
    }, { timeout: 18000, maxWait: 15000 });
  }
}
