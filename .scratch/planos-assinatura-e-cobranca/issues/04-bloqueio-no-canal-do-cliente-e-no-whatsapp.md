# 04: Bloqueio no Canal do Cliente e no WhatsApp

Parte da spec 052 (Planos, assinatura e cobrança recorrente).

**What to build:** quando a barbearia está bloqueada, os clientes dela não conseguem agendar pelo Canal do Cliente e nenhuma mensagem de WhatsApp da barbearia sai.

- **Canal do Cliente:**
  - A sessão do cliente e as funções de agendamento do cliente consultam o Estado de Acesso no servidor.
  - Com a barbearia bloqueada, o cliente vê "agendamento online indisponível" e não cria nem reagenda.
  - Cancelar continua permitido, para o cliente liberar o horário.
- **WhatsApp:**
  - Todo envio do tenant consulta o Estado de Acesso e não envia se estiver bloqueado. Vale para Evento de Agendamento, lembrete, lembrete de retorno e boas-vindas.
  - O envio que não saiu é descartado, com o motivo registrado, e não fica numa fila para depois.
  - A sessão da Instância WhatsApp não é tocada. Quando a barbearia volta, os envios voltam sem ler QR code.

**Blocked by:** 03 (Período de teste, Estado de Acesso e bloqueio do painel)

**Status:** done

- [x] pgTAP: com a barbearia bloqueada, criar e reagendar pelo Canal do Cliente são recusados e cancelar é aceito; com a barbearia liberada, tudo segue como hoje
- [x] pgTAP ou teste Deno: com a barbearia bloqueada, os envios de Evento de Agendamento, lembrete, lembrete de retorno e boas-vindas não chegam ao provedor e ficam registrados como descartados por bloqueio; liberada, saem como hoje. No teste, o tenant não tem instância conectada ao provedor real (nada sai de verdade pelo WhatsApp)
- [x] Teste do Canal do Cliente no front: barbearia bloqueada mostra "agendamento online indisponível"
- [x] Os testes atuais do Canal do Cliente e do WhatsApp continuam passando
- [x] `npm run lint`, `npm test` e `npm run build` passam

## Resultado (2026-09-29)

- **Migrations** aplicadas no DEV (`selvxobcjbkligxighlp`): `052_ticket04_bloqueio_no_canal_do_cliente_e_no_whatsapp` (versão `20260929200553`) e `052_ticket04_descarte_definitivo_no_livro` (versão `20260929203751`, da revisão de código).
- **Canal do Cliente, servidor.** `private.assert_online_booking_allowed(tenant)` lê o mesmo Estado de Acesso do painel e recusa com `ONLINE_BOOKING_UNAVAILABLE` (SQLSTATE `55000`). A guarda entra em `create_appointment_by_token`, `reschedule_appointment_by_token` (que a versão por sessão pública também chama) e `confirm_public_booking` (antes de cadastrar o cliente, então a recusa não deixa cliente pela metade). Cancelar e ver os próprios agendamentos não tem guarda: o cliente continua conseguindo liberar o horário.
- **Disponibilidade para a tela.** `public.get_public_booking_availability(slug)` devolve `false` se a barbearia está bloqueada, `true` se não, e nulo se o slug não existe. É público (anon), porque o cliente ainda não tem login.
- **Estado de Acesso para o servidor.** `public.get_tenant_access_state(tenant)` só é executável pelo `service_role`. `anon`, `authenticated`, o Gerente da própria barbearia e o Gerente com `tenant_id` nulo são barrados (42501), com asserção própria no pgTAP.
- **Descarte.** O livro de idempotência (`whatsapp_message_idempotency`) e a fila (`whatsapp_message_outbox`) aceitam o status `discarded`. `public.discard_whatsapp_message_outbox(id, motivo)` (só `service_role`) tira da fila o item que o worker reservou e não mexe em `customers`: uma boas-vindas descartada não marca `welcome_sent_at`. No livro, `public.register_whatsapp_message_discard(...)` (só `service_role`) cria a linha `discarded`, transforma em `discarded` a chave que ficou `failed` (retentável, para o desbloqueio não reenviar a mensagem velha) e deixa como está a enviada, a descartada e a recusada de vez pelo provedor. Chave repetida não vira erro (`on conflict do nothing`, que cobre também o índice único da janela de lembrete): uma barbearia bloqueada é reexaminada a cada rodada de lembretes.
- **WhatsApp, função `whatsapp-integration`.** `createMessageDispatcher` ganhou o portão (`accessGate`): antes de reservar e enviar, pergunta o estado da barbearia. Bloqueada: nada chega ao provedor, o descarte é gravado pela função do banco (`status = discarded`, `last_error = tenant_blocked:<motivo>`, `attempt_count = 0`) e o resultado é `discarded`. A função lê o estado uma vez por barbearia por requisição e não guarda falha em cache. Cada ponto de envio trata o `discarded`: evento de agendamento (cliente e barbeiro), lembrete (não marca `reminder_sent`), lembrete de retorno, boas-vindas direta e pela fila, resposta de primeiro contato (fecha a mensagem recebida como `discarded` e não responde) e envio manual (403). O worker da fila reconhece o `discarded` e chama a função de descarte em vez de tentar de novo.
- **Sem saber o estado, não envia.** Se a leitura do estado falha, o dispatcher rejeita e nada sai. O item da fila volta a ser tentado, o lembrete espera a próxima rodada, o evento responde 502.
- **Front, módulo `canal-cliente`.** Erro `AgendamentoOnlineIndisponivelError`; `consultarDisponibilidadeAgendamento` no adaptador; `agendamentoOnlineDisponivel(slug)` no repositório. **A recusa por bloqueio é lida antes do "indisponível" de conflito de horário**, porque a mensagem dela contém "indisponível" e o mapeamento antigo a trataria como conflito.
- **Front, telas.** `FluxoAgendamento` mostra "Agendamento online indisponível" (com o WhatsApp da barbearia) no lugar do catálogo, mantém a barra "Meus agendamentos" e, se a barbearia é bloqueada no meio do fluxo, troca o fluxo pela mesma tela quando o servidor recusa. `MenuCliente` mostra o aviso, esconde "Novo agendamento", "Agendar agora" e "Remarcar", avisa na aba Agendar da barra inferior e mantém "Cancelar". O `CardAgendamentoAtivo` passou a ter `onReschedule` opcional.
- **Testes.** pgTAP 66 (novo, 39 asserções, 39/39): criar e reagendar recusados e cancelar aceito com a barbearia bloqueada (pelo token e pela sessão pública), criar/reagendar/cancelar como antes com ela liberada, sem cliente pela metade, disponibilidade, privilégios e a guarda com Gerente de tenant nulo, descarte no livro (nova, `failed` vira `discarded`, enviada e falha permanente ficam como estão, chave repetida sem erro) e na fila. Deno: 99 testes (eram 79), com o dispatcher e uma rota de cada tipo de envio, incluindo a barbearia liberada, em aviso e a leitura que falha. Mutação: com o portão desligado, 9 dos 10 testes de bloqueio falham. Vitest: adaptador, repositório, componente, `FluxoAgendamento` e `MenuCliente`.
- `CONTEXT.md` ganhou Bloqueio por Assinatura.

### Decisões que valem lembrar

- **A sessão do cliente continua abrindo com a barbearia bloqueada.** Recusar a sessão impediria o cliente de ver e cancelar os próprios agendamentos, que é justamente o que a spec manda continuar valendo. A consulta do Estado de Acesso vai para a tela (disponibilidade) e para as funções que criam e reagendam, e a Edge Function `public-customer-session` não mudou.
- **Descartado é definitivo.** O lembrete de uma janela descartada por bloqueio não sai depois que a barbearia volta; só saem as mensagens novas. É o que a spec pede ("não fica numa fila para depois").
- **O WhatsApp fecha por padrão, o painel abre.** Sem conseguir ler o estado, o WhatsApp não envia (uma mensagem indevida para uma barbearia bloqueada é pior do que uma atrasada, e o item volta a ser tentado), enquanto o painel abre (travar todas as barbearias por uma falha de rede seria pior). É a diferença entre o que o front protege e o que o servidor protege.
- **O lembrete de uma barbearia bloqueada é reexaminado a cada 15 minutos.** A rotina não marca `reminder_sent` no descarte, então cada rodada reavalia os agendamentos da janela e não grava de novo (a chave já existe). O custo é limitado pela janela; se incomodar, dá para pular a barbearia bloqueada antes de listar os agendamentos.
- **O cliente que escreve para uma barbearia bloqueada continua sendo cadastrado** (`find_or_create_whatsapp_customer`), mas não recebe resposta.

### Pendência de deploy

- **Migration antes da função.** A função `whatsapp-integration` chama `get_tenant_access_state`; sem a migration aplicada, ela não envia nada. No DEV a migration está aplicada, mas **a função nova não foi publicada**: até o deploy dela, o DEV ainda envia WhatsApp de barbearia bloqueada. Em prod, aplicar a migration e depois publicar a função, e só depois do ticket 05.
- O DEV usa o mesmo servidor Uazapi de prod (exceção registrada no glossário). Os testes Deno usam provedor falso e o pgTAP não tem instância: nada foi enviado pelo WhatsApp real.
