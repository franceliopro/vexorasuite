import {assignedConversationScope} from "./conversation-visibility";
import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { AuthenticatedRequest } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const OPEN_STATUSES: Array<"OPEN" | "PENDING"> = ["OPEN", "PENDING"];
const DONE_STATUSES: Array<"RESOLVED" | "CLOSED"> = ["RESOLVED", "CLOSED"];

/** Runs an optional dashboard query without letting one unavailable source break the whole overview. */
async function optional<T>(run: () => Promise<unknown>, fallback: T): Promise<T> {
  try {
    return (await run()) as T;
  } catch {
    return fallback;
  }
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  const first = parts[0]?.charAt(0) || "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.charAt(0) || "" : "";
  return (first + last).toUpperCase() || "?";
}

function channelLabel(channel?: string | null): string {
  const value = String(channel || "").toUpperCase();
  if (value === "WHATSAPP") return "WhatsApp";
  if (value === "EMAIL") return "E-mail";
  if (value === "INSTAGRAM") return "Instagram";
  if (value === "FACEBOOK") return "Facebook";
  if (value === "MESSENGER") return "Messenger";
  if (value === "TELEGRAM") return "Telegram";
  return value ? value.charAt(0) + value.slice(1).toLowerCase() : "Canal";
}

type WaitingRow = {
  id: string;
  createdAt: Date;
  channel: string;
  contact: { name: string } | null;
  department: { name: string } | null;
};

type TeamRow = {
  assigneeId: string | null;
  department: { name: string } | null;
  assignee: { id: string; name: string } | null;
};

type TopicRow = {
  subject: string | null;
  channel: string;
  department: { name: string } | null;
};

type HourRow = { createdAt: Date };

type FirstResponseRow = {
  createdAt: Date;
  messages: Array<{ occurredAt: Date }>;
};

@Controller('overview')
@UseGuards(AuthGuard)
export class OverviewController {
 constructor(private readonly prisma:PrismaService){}
 @Get() async read(@Req() req:AuthenticatedRequest){
  const tenantId=req.user.tenantId;
  const admin=['OWNER','ADMIN'].includes(req.user.role);
  const teams=admin?[]:await this.prisma.departmentMember.findMany({where:{tenantId,userId:req.user.sub,department:{isActive:true,modules:{has:'INBOX'}}},select:{departmentId:true}});
  const scope={tenantId,deletedAt:null,...(!admin?assignedConversationScope(tenantId,req.user.sub,teams.map(t=>t.departmentId)):{})};
  const [openConversations,completedConversations,contacts,tenant,recent]=await Promise.all([
   this.prisma.conversation.count({where:{...scope,archivedAt:null,status:{in:['OPEN','PENDING']}}}),
   this.prisma.conversation.count({where:{...scope,status:{in:['RESOLVED','CLOSED']}}}),
   this.prisma.contact.count({where:{tenantId,conversations:{some:{tenantId,deletedAt:null,...(!admin?assignedConversationScope(tenantId,req.user.sub,teams.map(t=>t.departmentId)):{})}}}}),
   this.prisma.tenant.findUniqueOrThrow({where:{id:tenantId},select:{integrations:true}}),
   this.prisma.conversation.findMany({where:scope,orderBy:{updatedAt:'desc'},take:5,select:{id:true,status:true,updatedAt:true,contact:{select:{name:true}}}}),
  ]);

  const now = new Date();
  const dayAgo = new Date(now.getTime() - DAY_MS);
  const weekAgo = new Date(now.getTime() - 8 * DAY_MS);
  const monthAgo = new Date(now.getTime() - 30 * DAY_MS);
  const waitingWhere = {...scope,archivedAt:null,status:{in:OPEN_STATUSES},handlingMode:'HUMAN' as const,assigneeId:null};

  const [waitingTotal,waitingRows,teamRows,hourRows,topicRows,resolvedByAi,payments,firstResponseRows] = await Promise.all([
   optional(() => this.prisma.conversation.count({where:waitingWhere}), 0),
   optional(() => this.prisma.conversation.findMany({
     where:waitingWhere,
     orderBy:{createdAt:'asc'},
     take:6,
     select:{id:true,createdAt:true,channel:true,contact:{select:{name:true}},department:{select:{name:true}}},
   }), [] as WaitingRow[]),
   optional(() => this.prisma.conversation.findMany({
     where:{...scope,archivedAt:null,status:{in:OPEN_STATUSES},assigneeId:{not:null}},
     select:{assigneeId:true,department:{select:{name:true}},assignee:{select:{id:true,name:true}}},
   }), [] as TeamRow[]),
   optional(() => this.prisma.conversation.findMany({
     where:{...scope,createdAt:{gte:weekAgo}},
     select:{createdAt:true},
   }), [] as HourRow[]),
   optional(() => this.prisma.conversation.findMany({
     where:{...scope,createdAt:{gte:monthAgo}},
     select:{subject:true,channel:true,department:{select:{name:true}}},
   }), [] as TopicRow[]),
   optional(() => this.prisma.conversation.count({where:{...scope,status:{in:DONE_STATUSES},handlingMode:'BOT' as const}}), 0),
   optional(() => this.prisma.payment.findMany({where:{tenantId,status:{in:['RECEIVED','CONFIRMED']}},select:{amount:true}}), [] as Array<{amount:unknown}>),
   optional(() => this.prisma.conversation.findMany({
     where:{...scope,createdAt:{gte:monthAgo}},
     orderBy:{createdAt:'desc'},
     take:200,
     select:{createdAt:true,messages:{where:{direction:'OUTBOUND' as const},orderBy:{occurredAt:'asc' as const},take:1,select:{occurredAt:true}}},
   }), [] as FirstResponseRow[]),
  ]);

  const waitingItems = waitingRows.map((row) => ({
    id: row.id,
    contactName: row.contact?.name || "Contato sem nome",
    departmentName: row.department?.name || null,
    channel: channelLabel(row.channel),
    waitingMinutes: Math.max(0, Math.floor((now.getTime() - new Date(row.createdAt).getTime()) / 60000)),
  }));

  const teamMap = new Map<string, { id: string; name: string; openCount: number; departments: Map<string, number> }>();
  for (const row of teamRows) {
    if (!row.assigneeId || !row.assignee) continue;
    const entry = teamMap.get(row.assigneeId) || { id: row.assigneeId, name: row.assignee.name, openCount: 0, departments: new Map<string, number>() };
    entry.openCount += 1;
    const department = row.department?.name;
    if (department) entry.departments.set(department, (entry.departments.get(department) || 0) + 1);
    teamMap.set(row.assigneeId, entry);
  }
  const teamRanking = [...teamMap.values()].sort((a, b) => b.openCount - a.openCount).slice(0, 5);
  const teamMax = teamRanking.reduce((max, member) => Math.max(max, member.openCount), 0);
  const team = teamRanking.map((member) => {
    const department = [...member.departments.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    return {
      id: member.id,
      name: member.name,
      initials: initialsOf(member.name),
      openCount: member.openCount,
      loadPercent: teamMax ? Math.max(12, Math.round((member.openCount / teamMax) * 100)) : 12,
      departmentName: department,
      presence: "active" as const,
    };
  });

  const hourlyValues = Array<number>(24).fill(0);
  const previousBuckets = Array<number>(24).fill(0);
  for (const row of hourRows) {
    const createdAt = new Date(row.createdAt);
    const hour = createdAt.getUTCHours();
    if (createdAt >= dayAgo) hourlyValues[hour] = (hourlyValues[hour] || 0) + 1;
    else previousBuckets[hour] = (previousBuckets[hour] || 0) + 1;
  }
  const hourlyAverage = previousBuckets.map((value) => Math.round((value / 7) * 10) / 10);
  const peakValue = hourlyValues.reduce((max, value) => Math.max(max, value), 0);
  const peakIndex = hourlyValues.indexOf(peakValue);
  const hourly = {
    labels: Array.from({ length: 24 }, (_, hour) => `${String(hour).padStart(2, "0")}h`),
    values: hourlyValues,
    average: hourlyAverage,
    peakIndex: peakValue > 0 ? peakIndex : null,
    peakValue,
  };

  const topicMap = new Map<string, number>();
  for (const row of topicRows) {
    const label = (row.subject || "").trim() || row.department?.name || channelLabel(row.channel);
    topicMap.set(label, (topicMap.get(label) || 0) + 1);
  }
  const topicTotal = [...topicMap.values()].reduce((sum, value) => sum + value, 0);
  const topics = [...topicMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([label, count]) => ({ label, count, percent: topicTotal ? Math.round((count / topicTotal) * 100) : 0 }));

  const revenue = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const responseGaps = firstResponseRows
    .map((row) => row.messages[0] ? (new Date(row.messages[0].occurredAt).getTime() - new Date(row.createdAt).getTime()) / 1000 : null)
    .filter((gap): gap is number => gap !== null && gap >= 0 && gap < 86400);
  const firstResponseSeconds = responseGaps.length ? Math.round(responseGaps.reduce((sum, gap) => sum + gap, 0) / responseGaps.length) : null;

  const root=tenant.integrations as Record<string,any>;const assistantEnabled=root?.assistant?.enabled!==false;const agents=assistantEnabled&&Array.isArray(root?.assistant?.agents)?root.assistant.agents:[];
  return {
   openConversations,
   completedConversations,
   contacts,
   activeAgents:agents.filter((a:any)=>a.enabled===true).length,
   recent,
   scope:admin?'tenant':'assigned_and_team',
   updatedAt:new Date().toISOString(),
   waiting:{
     total:waitingTotal,
     oldestMinutes:waitingItems[0]?.waitingMinutes ?? null,
     items:waitingItems,
   },
   team,
   hourly,
   topics,
   kpis:{
     resolvedByAi,
     resolvedByAiPercent:completedConversations?Math.round((resolvedByAi/completedConversations)*100):0,
     revenue:Math.round(revenue*100)/100,
     payments:payments.length,
     firstResponseSeconds,
   },
  };
 }
}
