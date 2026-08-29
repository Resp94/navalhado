# Snapshot operacional — sessão de correção do Canal do Cliente

**Data:** 28/08/2026 22:55 (America/Manaus)  
**Commits de referência:** `44b9f36`, `1af3b21`.  
**Working tree:** limpo após o registro deste snapshot.

## Ambiente da validação

- Repositório local `C:\Projetos\navalhado`.
- Ambiente Dev: `https://dev.navalhado.com.br`.
- Navegador integrado e teste real pelo link público tokenizado do cliente.
- Banco Supabase remoto consultado por SQL e logs unificados.

## ✅ Funcional — entregas desta sessão

### Reagendamento pelo link público

- Link tokenizado abre o Canal do Cliente e valida o perfil sem acusar token expirado.
- O fluxo avança do painel para a seleção de data, horário e confirmação.
- O Adapter envia `p_appointment_id`, conforme a interface da RPC publicada no banco.
- A tentativa real de reagendamento retornou HTTP **200** na RPC `reschedule_appointment_by_token`.
- Não houve chamada ao fallback inválido nem novos erros `404` na tentativa validada.

### Persistência e notificações

- O agendamento do cliente foi persistido como `confirmed` no novo horário de 29/08 às 11:00–11:30 (horário de Manaus).
- O registro foi atualizado no mesmo instante da chamada da RPC.
- O evento `appointment_rescheduled` foi criado no `whatsapp_message_outbox` e processado com status `succeeded`.
- Não houve alteração destrutiva de dados nem migration necessária: a função correta já estava versionada no banco.

### Qualidade e regressão

- Teste regressivo do Adapter cobre o nome correto do parâmetro e garante que o fallback não seja chamado após sucesso.
- Suíte completa: **53 arquivos e 291 testes aprovados**.
- Build: **aprovado**.
- Lint: **código 0**, somente avisos preexistentes.
- `git diff --check`: **aprovado**.
- Code review final da alteração: **nenhum achado novo**.

## Regras críticas de preservação

- Manter isolamento por token e tenant no Canal do Cliente.
- Preservar as regras de disponibilidade, prazo e conflito da RPC de reagendamento.
- Não editar migrations aplicadas; alterações de banco futuras exigem nova migration versionada.
- Não alterar o fluxo de criação, cancelamento ou envio WhatsApp fora do escopo.
- Manter os itens de mensageria registrados no snapshot `2026-08-28-mensageria-review-hardening.md` como contratos de regressão.

## ⚠️ Limitações conhecidas

- A confirmação transacional foi realizada pelo usuário no link Dev; a validação automatizada cobre o contrato do Adapter, não confirma agendamentos reais automaticamente.
- O histórico de logs ainda contém as falhas `404` anteriores à correção; elas não representam a tentativa bem-sucedida registrada nesta sessão.

## Alterações desde o snapshot anterior

- Corrigido o contrato do parâmetro da RPC de reagendamento no frontend.
- Adicionado teste regressivo do Adapter.
- Confirmado o fluxo real, a persistência do novo horário e o processamento do evento de reagendamento no outbox.
