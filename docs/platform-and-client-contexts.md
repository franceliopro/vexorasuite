# Véxora e empresas clientes

Requisito confirmado pelo proprietário em 27/10/2026: o ambiente atual e seus recursos pertencem à Véxora; a Rastreabem será uma empresa cliente criada separadamente. Não mover recursos existentes para uma empresa cliente por dedução do nome de um fluxo de teste.

## Identidade e administração

- `Tenant.kind=PLATFORM`: painel da administração Véxora; requer vínculo ativo e `User.isPlatformAdmin` conferido no banco a cada requisição.
- `Tenant.kind=COMPANY`: empresa cliente com contatos, usuários, identidade visual, canais, Google e credenciais próprios.
- OWNER de empresa cliente não é administrador da plataforma. Não pode criar empresas nem redefinir senhas globais.
- O administrador Véxora cria a empresa cliente e recebe vínculo OWNER naquele contexto, sem copiar contatos, integrações ou credenciais.
- A troca de empresa exige vínculo atual, renova a sessão e recarrega a página para descartar o estado anterior.
- Cadastro público serve somente à primeira configuração de uma instalação vazia; após isso, empresas e pessoas são cadastradas pelo painel autorizado.
- A migração adota automaticamente o ambiente existente como Véxora somente quando há exatamente um ambiente e um único proprietário ativo. Não adivinha em instalações ambíguas.
- Em instalação ambígua, o operador configura explicitamente PLATFORM_OWNER_EMAIL e PLATFORM_TENANT_ID e executa `node apps/api/scripts/platform-bootstrap.cjs`. A conta deve já ser proprietária do ambiente indicado. Não cadastra usuários nem troca senhas.
- Não há prova nesta alteração de qual configuração existe no banco de produção ou de implantação no Dokploy.

## Plataformas dentro da mesma empresa

No cadastro, plataformas/carteiras são nomes informados pelo administrador. Cada uma gera Financeiro e Suporte com seus próprios departamentos, pipelines, modelos e rotinas. Comercial e Administrativo são compartilhados. Sem nomes informados, usa-se a estrutura inicial genérica.

Exemplo de configuração de uma empresa de rastreamento: Link, Ceeb Vision e Rastreabem. São três plataformas internas de uma única empresa cliente, não três empresas ou três contas Asaas. Esses nomes não são padrões do produto.

A base Asaas permanece da empresa. Não inferir a plataforma de um cliente a partir do cadastro Asaas, telefone ou nome; vínculos financeiros explícitos e múltiplos por plataforma permanecem no inventário de implementação.

## Atendimento e notificações

- Uma conversa em BOT não aparece em nenhuma fila de atendente, nem por URL direta, eventos ou indicadores. Ter departmentId durante uma automação não constitui atribuição humana.
- Atendentes consultam suas conversas, seus departamentos ativos e convites autorizados. “Todos abertos” mantém esse mesmo limite.
- Proprietários e administradores da empresa podem acompanhar a operação completa da própria empresa.
- Notificações nunca são distribuídas enquanto BOT ou sem destino humano. Destino individual avisa somente o responsável; destino departamental avisa os membros autorizados daquele departamento.
- Configuração por empresa permite ligar/desligar os avisos individuais e departamentais. Não habilita avisos do bot.
- Encaminhamento do motor e transferência manual emitem evento específico de atribuição.
- Uma pessoa em dois departamentos tem acesso aos dois contextos, sem transformar os demais departamentos em públicos.

## Senhas e acesso

Novos usuários recebem senha temporária padrão senha123, substituível no cadastro, e devem alterá-la antes de acessar módulos. A nova senha pessoal tem de 12 a 128 caracteres. O servidor bloqueia acessos diretos enquanto a troca está pendente.

Somente a administração Véxora redefine uma senha para o padrão temporário. A senha pessoal é armazenada como hash; não há leitura nem exibição de senha existente. Redefinição e troca invalidam sessões anteriores e removem dispositivos de notificações antigos.

Restrições individuais explícitas prevalecem sobre herança de padrões/departamentos e valem inclusive para OWNER/ADMIN de empresa cliente. Os controles visuais usam as permissões retornadas pelo servidor. A administração Véxora conserva recuperação administrativa.

WORDPRESS já tem chave de permissão separada e regra de URL. Isso não declara implementada uma integração WordPress completa; seu conector e suas operações ainda precisam ser entregues e validados.

Administradores de empresas não alteram permissões de contas administrativas, não concedem módulos que não possuem e não removem negativas existentes de atendentes. A reativação de permissões restritas pela administração Véxora permanece com a plataforma.
