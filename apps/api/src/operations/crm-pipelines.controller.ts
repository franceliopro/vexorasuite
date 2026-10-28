import {
  BadRequestException,
  Controller,
  Get,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { isUUID } from "class-validator";
import { PrismaService } from "../prisma/prisma.service";
import { AuthGuard } from "../auth/auth.guard";
import { AuthenticatedRequest } from "../auth/auth.types";
import { administrative } from "../auth/module-policy";
import { PIPELINE_TEMPLATES } from "./departments.controller";
export async function accessiblePipeline(
  prisma: PrismaService,
  req: AuthenticatedRequest,
  id: string,
) {
  if (!isUUID(id)) throw new BadRequestException("Selecione um pipeline.");
  const pipeline = await prisma.crmPipeline.findFirst({
    where: {
      id,
      tenantId: req.user.tenantId,
      ...(!administrative(req.user.role)
        ? {
            enabled: true,
            department: {
              isActive: true,
              modules: { has: "CRM" },
              members: {
                some: { tenantId: req.user.tenantId, userId: req.user.sub },
              },
            },
          }
        : {}),
    },
  });
  if (!pipeline)
    throw new BadRequestException("Pipeline não encontrado ou sem acesso.");
  return pipeline;
}
export async function contactPipelineAccess(
  prisma: PrismaService,
  req: AuthenticatedRequest,
  id: string,
) {
  const contact = await prisma.contact.findFirst({
    where: { id, tenantId: req.user.tenantId },
    select: { pipelineId: true },
  });
  if (!contact) throw new BadRequestException("Contato não encontrado.");
  if (!administrative(req.user.role)) {
    if(!contact.pipelineId){const permitted=req.user.allowedModules?.includes('INBOX')&&await prisma.conversation.findFirst({where:{tenantId:req.user.tenantId,contactId:id,deletedAt:null,OR:[{assigneeId:req.user.sub},{departmentId:{in:req.user.departmentIds||[]}}]},select:{id:true}});if(!permitted)throw new BadRequestException('Este contato não pertence a um CRM permitido.');return contact;}
    await accessiblePipeline(prisma, req, contact.pipelineId);
  }
  return contact;
}
@Controller("crm")
@UseGuards(AuthGuard)
export class CrmPipelinesController {
  constructor(private readonly prisma: PrismaService) {}
  @Get("pipelines") async list(@Req() req: AuthenticatedRequest) {
    return {
      templates: PIPELINE_TEMPLATES,
      pipelines: await this.prisma.crmPipeline.findMany({
        where: {
          tenantId: req.user.tenantId,
          enabled: true,
          ...(!administrative(req.user.role)
            ? {
                department: {
                  isActive: true,
                  modules: { has: "CRM" },
                  members: {
                    some: { tenantId: req.user.tenantId, userId: req.user.sub },
                  },
                },
              }
            : {}),
        },
        include: { department: { select: { id: true, name: true } } },
        orderBy: { name: "asc" },
      }),
    };
  }
}
