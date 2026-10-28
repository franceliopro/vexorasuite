import { moduleSelection } from "../auth/module-policy";
import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Patch, Param, ParseUUIDPipe,
  Req,
  UseGuards,
} from "@nestjs/common";
import { hash } from "bcryptjs";
import { isUUID } from "class-validator";
import { AuthGuard } from "../auth/auth.guard";
import { AuthenticatedRequest } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";
import { EventsService } from "./events.service";
@Controller("team")
@UseGuards(AuthGuard)
export class TeamController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
  ) {}
  private admin(req: AuthenticatedRequest) {
    if (!["OWNER", "ADMIN"].includes(req.user.role))
      throw new ForbiddenException(
        "Somente administradores podem cadastrar atendentes.",
      );
  }
  @Get() async list(@Req() req: AuthenticatedRequest) {
    this.admin(req);
    const rows = await this.prisma.membership.findMany({
      where: { tenantId: req.user.tenantId },
      select: {
        role: true,
        modules: true,
        user: { select: { id: true, name: true, email: true, isActive: true } },
      },
      orderBy: { user: { name: "asc" } },
    });
    const members = await this.prisma.departmentMember.findMany({
      where: { tenantId: req.user.tenantId },
      select: { departmentId: true, userId: true },
    });
    return rows.map((r) => ({
      ...r.user,
      role: r.role,
      modules: r.modules,
      departmentIds: members
        .filter((m) => m.userId === r.user.id)
        .map((m) => m.departmentId),
    }));
  }
  @Post() async create(@Req() req: AuthenticatedRequest, @Body() input: any) {
    this.admin(req);
    const name = typeof input.name === "string" ? input.name.trim() : "";
    const email =
      typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
    if (
      name.length < 2 ||
      name.length > 160 ||
      !/^[-\w.+]+@[\w.-]+\.[a-z]{2,}$/i.test(email) ||
      email.length > 254 ||
      typeof input.password !== "string" ||
      input.password.length < 12 ||
      input.password.length > 128
    )
      throw new BadRequestException(
        "Informe nome, e-mail e senha inicial de 12 a 128 caracteres.",
      );
    const ids = Array.isArray(input.departmentIds)
      ? ([...new Set(input.departmentIds)] as string[])
      : [];
    if (
      ids.length > 50 ||
      ids.some((id) => typeof id !== "string" || !isUUID(id))
    )
      throw new BadRequestException("Selecione os setores válidos.");
    if (
      await this.prisma.user.findUnique({
        where: { email },
        select: { id: true },
      })
    )
      throw new BadRequestException(
        "Este e-mail já possui uma conta. Use outro e-mail ou o vínculo existente da empresa.",
      );
    let modules: string[];
    try {
      modules = moduleSelection(input.modules || []);
    } catch {
      throw new BadRequestException("Módulos inválidos.");
    }
    const passwordHash = await hash(input.password, 12);
    try {
      const user = await this.prisma.$transaction(async (tx) => {
        const departments = await tx.department.count({
          where: {
            id: { in: ids },
            tenantId: req.user.tenantId,
            isActive: true,
          },
        });
        if (departments !== ids.length)
          throw new BadRequestException(
            "Um setor não está ativo nesta empresa.",
          );
        const user = await tx.user.create({
          data: { name, email, passwordHash },
          select: { id: true, name: true, email: true },
        });
        await tx.membership.create({
          data: {
            tenantId: req.user.tenantId,
            userId: user.id,
            role: "AGENT",
            modules,
          },
        });
        if (ids.length)
          await tx.departmentMember.createMany({
            data: ids.map((departmentId) => ({
              tenantId: req.user.tenantId,
              departmentId,
              userId: user.id,
            })),
          });
        await tx.auditLog.create({
          data: {
            tenantId: req.user.tenantId,
            userId: req.user.sub,
            action: "team.agent.created",
            entityType: "user",
            entityId: user.id,
            details: { departmentIds: ids },
          },
        });
        return user;
      });
      this.events.publish(req.user.tenantId, "team.updated", { id: user.id });
      return user;
    } catch (e) {
      if ((e as any).code === "P2002")
        throw new BadRequestException("Este e-mail já possui uma conta.");
      throw e;
    }
  }
 @Patch(':id/access') async access(@Req() req:AuthenticatedRequest,@Param('id',ParseUUIDPipe) id:string,@Body() input:any){this.admin(req);let modules:string[];try{modules=moduleSelection(input.modules||[])}catch{throw new BadRequestException('Módulos inválidos.');}const ids=Array.isArray(input.departmentIds)?[...new Set(input.departmentIds)] as string[]:[];if(ids.length>50||ids.some(x=>!isUUID(x)))throw new BadRequestException('Setores inválidos.');await this.prisma.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM tenants WHERE id=${req.user.tenantId}::uuid FOR UPDATE`;const member=await tx.membership.findFirst({where:{tenantId:req.user.tenantId,userId:id}});if(!member||await tx.department.count({where:{tenantId:req.user.tenantId,id:{in:ids},isActive:true}})!==ids.length)throw new BadRequestException('Atendente ou setor não pertence à empresa.');await tx.membership.update({where:{id:member.id},data:{modules}});await tx.departmentMember.deleteMany({where:{tenantId:req.user.tenantId,userId:id}});if(ids.length)await tx.departmentMember.createMany({data:ids.map(departmentId=>({tenantId:req.user.tenantId,departmentId,userId:id}))});await tx.auditLog.create({data:{tenantId:req.user.tenantId,userId:req.user.sub,action:'team.access.updated',entityType:'user',entityId:id,details:{modules,departmentIds:ids}}});});this.events.publish(req.user.tenantId,'team.updated',{id});return {updated:true};}

}
