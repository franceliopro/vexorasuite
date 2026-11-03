# Recuperação de senha

## Fluxo

1. Na tela de entrada, **Esqueceu a senha?** pede o e-mail (e, opcionalmente, o identificador da empresa).
2. `POST /api/auth/password/forgot` responde **sempre** a mesma coisa — exista ou não a conta. Isso
   impede usar o formulário para descobrir quem tem cadastro.
3. Se a conta existir, o link `https://app.vexorasuite.com.br/?reset=<token>` é enviado pelo
   transporte de e-mail (`docs/email.md`).
4. O app abre direto no formulário de nova senha, valida 12+ caracteres e a confirmação.
5. `POST /api/auth/password/reset` grava a senha, **consome o token** e incrementa `authVersion`,
   derrubando todas as sessões abertas daquele usuário.

## Regras de segurança

| Regra | Por quê |
|---|---|
| Token de 32 bytes aleatórios, guardado só como **SHA-256** | vazamento do banco não permite reutilizar link |
| Validade de 30 min (`PASSWORD_RESET_TTL_MINUTES`, 5–120) | janela curta para uma caixa de e-mail comprometida |
| Uso único, consumido na mesma transação da troca | dois cliques simultâneos não geram duas senhas |
| Novo pedido invalida todos os links anteriores | só o link mais recente vale |
| `authVersion` incrementado | sessão roubada morre na troca |
| Resposta genérica + limite de 10 tentativas/min por IP e por e-mail | evita enumeração de contas |
| Token retirado da barra de endereço após o uso | não fica no histórico do navegador |

## Onde está

- API: `apps/api/src/auth/auth.service.ts` (`requestPasswordReset`, `resetPassword`) e
  `apps/api/src/auth/password-reset.spec.ts` (11 casos).
- Tela: `apps/web/src/app/auth-screen.tsx` + `apps/web/src/lib/password-reset.ts`
  (`apps/web/test/password-reset.test.mjs`).
- Migração: `20261103170000_password_reset_tokens`.

## Requisito para funcionar de ponta a ponta

O e-mail precisa estar configurado (`MAIL_HOST` + `MAIL_FROM`). Sem SMTP o pedido é aceito, o link é
registrado no log do container e **nenhum e-mail sai** — comportamento intencional, para nunca
anunciar um envio que não aconteceu.
