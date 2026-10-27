import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import { AuthGuard } from "../auth/auth.guard";
import { AuthenticatedRequest } from "../auth/auth.types";
import { MailService } from "./mail.service";
import { cleanEmail } from "./content";
@Controller("mail")
@UseGuards(AuthGuard)
export class MailController {
  constructor(private readonly mail: MailService) {}
  @Get() list(@Req() req: AuthenticatedRequest) {
    return this.mail.list(req);
  }
  @Post("accounts") account(
    @Req() req: AuthenticatedRequest,
    @Body() input: any,
  ) {
    return this.mail.saveAccount(req, input || {});
  }
  @Post("accounts/:id/disconnect") disconnect(
    @Req() req: AuthenticatedRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.mail.disconnect(req, id);
  }
  @Post("accounts/:id/verify") verify(
    @Req() req: AuthenticatedRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.mail.verify(req, id);
  }
  @Post("accounts/:id/sync") sync(
    @Req() req: AuthenticatedRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.mail.sync(req, id);
  }
  @Get("accounts/:id/messages") inbox(
    @Req() req: AuthenticatedRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.mail.inbox(req, id);
  }
  @Get("messages/:id") read(
    @Req() req: AuthenticatedRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.mail.read(req, id);
  }
  @Get("audience") audience(
    @Req() req: AuthenticatedRequest,
    @Query("kind") kind = "all",
    @Query("month") month = "0",
  ) {
    return this.mail.audience(req, kind, Number(month));
  }
  @Post("messages/:id/reply") reply(
    @Req() req: AuthenticatedRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: any,
  ) {
    return this.mail.reply(req, id, input || {});
  }
  @Post("templates") template(
    @Req() req: AuthenticatedRequest,
    @Body() input: any,
  ) {
    return this.mail.saveTemplate(req, input || {});
  }
  @Post("preview") preview(@Body() input: any) {
    return { html: cleanEmail(input?.html) };
  }
  @Post("campaigns") campaign(
    @Req() req: AuthenticatedRequest,
    @Body() input: any,
  ) {
    return this.mail.campaign(req, input || {});
  }
  @Get("campaigns/:id") status(
    @Req() req: AuthenticatedRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.mail.campaignStatus(req, id);
  }
  @Post("campaigns/:id/send") send(
    @Req() req: AuthenticatedRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: any,
  ) {
    return this.mail.activate(req, id, input || {});
  }
  @Post("campaigns/:id/pause") pause(
    @Req() req: AuthenticatedRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.mail.pause(req, id);
  }
}
@Controller("mail/unsubscribe")
export class MailUnsubscribeController {
  constructor(private readonly mail: MailService) {}
  @Get(":id/:token") confirm(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("token") token: string,
    @Res() res: Response,
  ) {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'",
    );
    if (!this.mail.validToken(id, token))
      return res.status(400).send("Link inválido.");
    return res
      .type("html")
      .send(
        '<!doctype html><html lang="pt-BR"><meta name="viewport" content="width=device-width"><title>Preferências de e-mail</title><body style="font:16px system-ui;padding:32px"><h1>Parar de receber campanhas?</h1><p>Confirme para retirar seu endereço dos próximos envios desta empresa.</p><form method="post"><button>Não quero receber campanhas</button></form></body></html>',
      );
  }
  @Post(":id/:token") async unsubscribe(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("token") token: string,
    @Res() res: Response,
  ) {
    await this.mail.unsubscribe(id, token);
    res.setHeader("Cache-Control", "no-store");
    return res
      .type("html")
      .send(
        '<!doctype html><html lang="pt-BR"><meta name="viewport" content="width=device-width"><title>Preferência salva</title><body><p>Preferência salva. Você não receberá novas campanhas desta empresa.</p></body></html>',
      );
  }
}
