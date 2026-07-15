# Onboarding de novos clientes via WhatsApp

## Status

Aprovado em 2026-07-15.

## Contexto

Atualmente, o webhook da Evolution Go responde com o link de agendamento somente quando o telefone remetente já pertence a um registro em `public.customers`. Números novos chegam ao webhook, mas são ignorados porque ainda não possuem cliente nem `token_acesso`.

O fluxo aprovado deve responder automaticamente com o link, coletar o nome na página de agendamento apenas no primeiro acesso e reutilizar o cadastro nos acessos seguintes.

## Decisão

O primeiro contato cria ou reutiliza um **cliente provisório** identificado por barbearia e telefone normalizado. O bot envia somente o link tokenizado. A página solicita o nome quando `cadastro_completo = false`; depois de salvar o nome, libera o agendamento e não repete a etapa.

## Fluxo

1. A Evolution Go envia o evento `Message` ao webhook.
2. A Edge Function ignora mensagens próprias, grupos e broadcasts.
3. A Edge Function identifica a barbearia pela chave da instância e normaliza o telefone remetente para o formato brasileiro com DDI 55.
4. Uma RPC atômica busca o cliente por `tenant_id + telefone_normalizado`.
5. Se o cliente não existir, a RPC cria um registro provisório com token, telefone, nome temporário e `cadastro_completo = false`.
6. A RPC retorna sempre o mesmo cliente e token para contatos repetidos ou concorrentes.
7. O bot responde somente com `/cliente/{token}/agendar`.
8. A página valida o token. Se o cadastro estiver incompleto, mostra o formulário de nome antes das etapas da agenda.
9. Uma RPC valida e salva o nome, marca `cadastro_completo = true` e retorna os dados atualizados.
10. A agenda é liberada. Acessos posteriores não mostram novamente o formulário.

## Modelo de dados

- Adicionar `customers.cadastro_completo boolean not null default true`.
- Clientes existentes permanecem completos durante a migração.
- Novos clientes criados pelo webhook recebem `cadastro_completo = false`.
- `customers.name` continua obrigatório. O valor provisório usa o nome de perfil do WhatsApp quando disponível; caso contrário, usa `Cliente`.
- Adicionar uma função SQL imutável para converter telefones brasileiros ao formato `55DDDNUMERO`.
- Adicionar `customers.telefone_normalizado` como coluna gerada a partir de `phone`, impedindo divergência entre escritores.
- Uma restrição única sobre `tenant_id + telefone_normalizado` garante no máximo um cliente por barbearia e telefone.
- O mesmo telefone pode pertencer a clientes de barbearias diferentes.
- Um cadastro completo nunca volta ao estado provisório.

## Contratos de domínio

### Buscar ou criar cliente do WhatsApp

Entrada: chave/identidade da instância, telefone remetente e nome de perfil opcional.

Saída: `customer_id`, `tenant_id`, `token_acesso`, `cadastro_completo` e indicação de criação ou reutilização.

Garantias: operação atômica, isolamento por tenant, normalização única e preservação de clientes existentes.

### Concluir cadastro

Entrada: `token_acesso` e nome informado.

Saída: dados atualizados do cliente.

Regras: nome aparado, entre 2 e 100 caracteres, token válido e cadastro marcado como completo de forma idempotente.

## Frontend

- `get_customer_details_by_token` passa a retornar `cadastro_completo`.
- `FluxoAgendamento` mantém o token atual e carrega os dados do cliente.
- Cadastro incompleto renderiza uma etapa inicial de nome e bloqueia serviços, profissionais, horários e confirmação.
- Após conclusão bem-sucedida, o estado local é atualizado e a primeira etapa normal da agenda é exibida sem trocar o token.
- Cadastro completo preserva integralmente o fluxo atual.

## Falhas e idempotência

- Falha ao buscar ou criar cliente impede o envio de um link inválido e retorna erro ao provedor.
- Falha do endpoint de envio retorna erro para permitir retry da Evolution Go.
- Mensagens repetidas reutilizam cliente e token.
- Mensagens concorrentes não criam duplicatas.
- Cadastros provisórios abandonados permanecem sem agendamentos; limpeza automática não faz parte deste escopo.
- Links continuam sendo credenciais bearer, mantendo o modelo de segurança atual.

## Testes

- Migração preserva clientes atuais como completos.
- Normalização produz o mesmo telefone para formatos locais e com DDI.
- RPC cria um provisório para número novo.
- RPC reutiliza cliente existente sem sobrescrever nome ou estado.
- Concorrência retorna um único cliente/token.
- O mesmo telefone pode existir em tenants diferentes.
- Webhook envia link para cliente novo e existente.
- Webhook ignora mensagens próprias, grupos e broadcasts.
- Frontend exige nome apenas para cadastro incompleto.
- Nome inválido não conclui o cadastro.
- Nome válido conclui o cadastro e libera a agenda.
- Novo acesso com o mesmo token não repete o formulário.
- Cenário ponta a ponta: mensagem → link → nome → agendamento → retorno direto.

## Fora de escopo

- Conversa do bot para coletar nome.
- Expiração ou limpeza automática de clientes provisórios.
- Substituição do token bearer por autenticação com OTP.
- Link público sem identificação prévia do telefone.
