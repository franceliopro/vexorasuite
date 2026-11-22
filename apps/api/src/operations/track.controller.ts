import {
  BadRequestException, Body, ConflictException, Controller, ForbiddenException, Get, Headers,
  HttpCode, Injectable, NotFoundException, Param, ParseUUIDPipe, Post, Query, Req, UnauthorizedException, UseGuards,
} from "@nestjs/common";
import { Prisma } from "../generated/prisma/client";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { isUUID } from "class-validator";
import { AuthGuard } from "../auth/auth.guard";
import { AuthenticatedRequest } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";

const positionFields = { latitude: true, longitude: true, speedKph: true, battery: true, recordedAt: true, receivedAt: true } as const;
const positionOrder = [{ recordedAt: "desc" }, { receivedAt: "desc" }, { id: "desc" }] satisfies Prisma.TrackPositionOrderByWithRelationInput[];
const day = 86400_000;

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string,unknown> : {};
}
function hash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
function label(value: unknown, name: string, max: number) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) throw new BadRequestException(name + " inválido.");
  return value.trim();
}
function number(value: unknown, min: number, max: number, name: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) throw new BadRequestException(name + " inválido.");
  return value;
}
function validatePosition(input: unknown) {
  const body = record(input);
  const eventId = label(body.eventId, "Identificador do evento", 120);
  const recordedAt = typeof body.recordedAt === "string" && /(?:Z|[+-]\d{2}:\d{2})$/i.test(body.recordedAt) ? new Date(body.recordedAt) : null;
  const now = Date.now();
  if (!recordedAt || !Number.isFinite(+recordedAt) || +recordedAt > now + 60_000 || +recordedAt < now - 30 * day) {
    throw new BadRequestException("Informe a data do equipamento com fuso, dentro dos últimos 30 dias.");
  }
  return {
    eventId, recordedAt, latitude: number(body.latitude, -90, 90, "Latitude"), longitude: number(body.longitude, -180, 180, "Longitude"),
    speedKph: body.speedKph == null ? null : number(body.speedKph, 0, 1000, "Velocidade"),
    battery: body.battery == null ? null : number(body.battery, 0, 100, "Bateria"),
  };
}

@Injectable()
export class TrackService {
  constructor(private readonly prisma: PrismaService) {}

  private isManager(request: AuthenticatedRequest) {
    return ["OWNER", "ADMIN"].includes(request.user.role);
  }

  private requireManager(request: AuthenticatedRequest) {
    if (!this.isManager(request)) throw new ForbiddenException("Somente administradores gerenciam dispositivos.");
  }

  private scope(request: AuthenticatedRequest): Prisma.TrackDeviceWhereInput {
    const { tenantId, sub } = request.user;
    if (this.isManager(request)) return { tenantId };
    return { tenantId, department: { tenantId, isActive: true, modules: { has: "INBOX" }, members: { some: { tenantId, userId: sub } } } };
  }

  async list(request: AuthenticatedRequest, page: number) {
    const manager = this.isManager(request);
    const [devices, departments] = await Promise.all([
      this.prisma.trackDevice.findMany({
        where: this.scope(request), orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * 50, take: 51,
        select: {
          id: true, name: true, reference: true, isActive: true, isSimulation: true,
          department: { select: { name: true } },
          positions: { orderBy: positionOrder, take: 1, select: positionFields },
        },
      }),
      manager ? this.prisma.department.findMany({
        where: { tenantId: request.user.tenantId, isActive: true, modules: { has: "INBOX" } },
        select: { id: true, name: true }, orderBy: { name: "asc" },
      }) : [],
    ]);
    const items = devices.slice(0, 50);
    const latest = items.length ? await this.prisma.$queryRaw<{device_id: string; seen: Date}[]>`
      SELECT device_id, MAX(received_at) AS seen
      FROM track_positions WHERE device_id IN (${Prisma.join(items.map(item => Prisma.sql`${item.id}::uuid`))})
      GROUP BY device_id
    ` : [];
    const latestByDevice = new Map(latest.map(item => [item.device_id, item.seen]));
    return {
      manager, departments, hasNext: devices.length > 50,
      devices: items.map(({ positions, ...item }) => ({ ...item, position: positions[0] ?? null, lastSeenAt: latestByDevice.get(item.id) ?? null })),
    };
  }

  async history(request: AuthenticatedRequest, id: string) {
    const device = await this.prisma.trackDevice.findFirst({
      where: { id, AND: [this.scope(request)] }, select: { id: true },
    });
    if (!device) throw new NotFoundException("Dispositivo indisponível.");
    return this.prisma.trackPosition.findMany({ where: { deviceId: id }, orderBy: positionOrder, take: 50, select: { id: true, ...positionFields } });
  }

  async create(request: AuthenticatedRequest, value: unknown) {
    this.requireManager(request);
    const { tenantId, sub } = request.user;
    const input = record(value);
    const name = label(input.name, "Nome do dispositivo", 100);
    const reference = label(input.reference, "Referência", 80).toUpperCase();
    const isSimulation = input.isSimulation !== false;
    const token = randomBytes(32).toString("base64url");
    const departmentId = input.departmentId;
    if (departmentId != null && (typeof departmentId !== "string" || !isUUID(departmentId))) throw new BadRequestException("Equipe inválida.");
    try {
      return await this.prisma.$transaction(async tx => {
        if (departmentId && !await tx.department.findFirst({
          where: { id: departmentId, tenantId, isActive: true, modules: { has: "INBOX" } }, select: { id: true },
        })) throw new BadRequestException("Equipe indisponível.");
        const device = await tx.trackDevice.create({
          data: { tenantId, name, reference, isSimulation, departmentId, tokenHash: hash(token) }, select: { id: true },
        });
        await tx.auditLog.create({ data: { tenantId, userId: sub, action: "track.device_created", entityType: "track_device", entityId: device.id } });
        return { id: device.id, ...(isSimulation ? {} : { token }) };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("Já existe um dispositivo com esta referência na empresa.");
      }
      throw error;
    }
  }

  async change(request: AuthenticatedRequest, id: string, action: string) {
    this.requireManager(request);
    if (!["rotate", "pause", "resume"].includes(action)) throw new BadRequestException("Ação inválida.");
    const { tenantId, sub } = request.user;
    const token = randomBytes(32).toString("base64url");
    return this.prisma.$transaction(async tx => {
      const changed = await tx.trackDevice.updateMany({
        where: { id, tenantId, ...(action === "rotate" ? { isSimulation: false } : {}) },
        data: action === "rotate" ? { tokenHash: hash(token) } : { isActive: action === "resume" },
      });
      if (!changed.count) throw new NotFoundException("Dispositivo indisponível para esta ação.");
      await tx.auditLog.create({ data: { tenantId, userId: sub, action: "track." + action, entityType: "track_device", entityId: id } });
      return action === "rotate" ? { token } : { ok: true };
    });
  }

  async simulate(request: AuthenticatedRequest, id: string, input: unknown) {
    this.requireManager(request);
    const { tenantId } = request.user;
    const position = validatePosition({ ...record(input), eventId: randomUUID(), recordedAt: new Date().toISOString() });
    const device = await this.prisma.trackDevice.findFirst({ where: { id, tenantId, isActive: true, isSimulation: true }, select: { id: true } });
    if (!device) throw new NotFoundException("Dispositivo simulado indisponível.");
    await this.prisma.trackPosition.create({ data: { ...position, deviceId: id } });
    return { ok: true };
  }

  async ingest(authorization: unknown, input: unknown) {
    const token = typeof authorization === "string" ? /^Bearer ([A-Za-z0-9_-]{43})$/.exec(authorization)?.[1] : null;
    if (!token) throw new UnauthorizedException("Credencial do dispositivo inválida.");
    const tokenHash = hash(token);
    const device = await this.prisma.trackDevice.findFirst({
      where: { tokenHash, isActive: true, isSimulation: false, tenant: { status: "ACTIVE" } }, select: { id: true },
    });
    if (!device) throw new UnauthorizedException("Credencial do dispositivo inválida.");
    const position = validatePosition(input);
    return this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM track_devices WHERE id = ${device.id}::uuid FOR UPDATE`;
      const valid = await tx.trackDevice.findFirst({
        where: { id: device.id, tokenHash, isActive: true, isSimulation: false, tenant: { status: "ACTIVE" } }, select: { id: true },
      });
      if (!valid) throw new UnauthorizedException("Credencial do dispositivo inválida.");
      const previous = await tx.trackPosition.findUnique({ where: { deviceId_eventId: { deviceId: device.id, eventId: position.eventId } } });
      if (previous) {
        if (+previous.recordedAt !== +position.recordedAt || previous.latitude !== position.latitude ||
          previous.longitude !== position.longitude || previous.battery !== position.battery || previous.speedKph !== position.speedKph) {
          throw new ConflictException("Este identificador já foi usado para outra posição.");
        }
        return { ok: true, duplicate: true };
      }
      await tx.trackPosition.create({ data: { ...position, deviceId: device.id } });
      return { ok: true, duplicate: false };
    });
  }
}

@Controller("track")
@UseGuards(AuthGuard)
export class TrackController {
  constructor(private readonly track: TrackService) {}

  @Get("devices")
  devices(@Req() request: AuthenticatedRequest, @Query("page") raw?: string) {
    const page = raw === undefined ? 1 : Number(raw);
    if (!Number.isInteger(page) || page < 1 || page > 1000) throw new BadRequestException("Página inválida.");
    return this.track.list(request, page);
  }

  @Post("devices")
  create(@Req() request: AuthenticatedRequest, @Body() input: unknown) { return this.track.create(request, input); }

  @Get("devices/:id/history")
  history(@Req() request: AuthenticatedRequest, @Param("id", ParseUUIDPipe) id: string) { return this.track.history(request, id); }

  @Post("devices/:id/simulate")
  simulate(@Req() request: AuthenticatedRequest, @Param("id", ParseUUIDPipe) id: string, @Body() input: unknown) { return this.track.simulate(request, id, input); }

  @Post("devices/:id/:action")
  change(@Req() request: AuthenticatedRequest, @Param("id", ParseUUIDPipe) id: string, @Param("action") action: string) { return this.track.change(request, id, action); }
}

@Controller("track")
export class TrackIngestController {
  constructor(private readonly track: TrackService) {}

  @Post("ingest")
  @HttpCode(200)
  ingest(@Headers("authorization") authorization: unknown, @Body() body: unknown) { return this.track.ingest(authorization, body); }
}
