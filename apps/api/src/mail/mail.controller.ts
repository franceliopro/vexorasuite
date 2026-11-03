import { Body, Controller, ForbiddenException, Get, Post, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { AuthenticatedRequest } from "../auth/auth.types";
import { MailService } from "./mail.service";
import { renderEmail } from "./mail.template";

/** Platform-side diagnostics: the client companies never see or configure mail. */
@Controller("mail")
export class MailController {
  constructor(private readonly mail: MailService) {}

  private platformAdmin(req: AuthenticatedRequest) {
    if (req.user.isPlatformAdmin !== true) {
      throw new ForbiddenException("Somente a administração Véxora consulta o transporte de e-mail.");
    }
  }

  @UseGuards(AuthGuard)
  @Get("status")
  status(@Req() req: AuthenticatedRequest) {
    this.platformAdmin(req);
    return this.mail.status();
  }

  @UseGuards(AuthGuard)
  @Post("verify")
  async verify(@Req() req: AuthenticatedRequest) {
    this.platformAdmin(req);
    return this.mail.verify();
  }

  @UseGuards(AuthGuard)
  @Post("test")
  async test(@Req() req: AuthenticatedRequest, @Body() input: { to?: unknown }) {
    this.platformAdmin(req);
    const to = typeof input?.to === "string" && input.to.includes("@") ? input.to.trim() : "";
    if (!to) {
      return { delivered: false, transport: this.mail.status().transport, reason: "Informe o endereço que deve receber o teste." };
    }
    const { html, text } = renderEmail({
      title: "Teste do transporte de e-mail",
      intro: "Se você recebeu esta mensagem, o SMTP da Véxora Suite está enviando com sucesso.",
      footnote: "Este envio foi solicitado pela administração da plataforma.",
    });
    return this.mail.send({ to, subject: "Véxora Suite — teste de envio", text, html });
  }
}
