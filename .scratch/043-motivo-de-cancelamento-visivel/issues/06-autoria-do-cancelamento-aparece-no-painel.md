# 06: Autoria do cancelamento aparece no painel

**What to build:** diante de um horário vago, a primeira pergunta do gerente é "o cliente desmarcou ou fomos nós?". Hoje isso é irrecuperável: não existe coluna de autoria, as RPCs de cancelamento não registram autor, e o único indício é o texto padrão gravado quando o cliente não escreve motivo — indício que some no instante em que o cliente escreve um motivo de verdade.

Depois deste ticket, cada Agendamento cancelado guarda quem cancelou, e o Painel de Cancelados do Dia mostra isso ao lado do motivo. A distinção é entre barbearia e cliente.

Decisão consciente de não separar gerente de barbeiro: as duas telas chamam a mesma RPC e o banco não identifica o autor individual ali. Separar exigiria propagar identidade de usuário por um caminho que não existe, e "barbearia contra cliente" é a distinção que responde à pergunta operacional.

**Blocked by:** 04 (Barbeiro vê o Painel de Cancelados do Dia)

**Status:** ready-for-agent

- [ ] A tabela de Agendamento ganha coluna de autoria do cancelamento, com domínio fechado validado por restrição de verificação, anulável
- [ ] A RPC de cancelamento pelo gestor — usada pela Agenda do gerente e pela Minha Agenda do barbeiro — grava autoria de barbearia
- [ ] As duas RPCs do Canal do Cliente, a por token e a por sessão pública, gravam autoria de cliente
- [ ] A autoria é gravada mesmo quando o cliente escreve um motivo próprio, de modo que a distinção não dependa do texto padrão
- [ ] A coluna é escrita exclusivamente pelas RPCs, nunca pela tela
- [ ] Nenhum backfill: Agendamento cancelado antes deste ticket fica com autoria nula
- [ ] Agendamento não cancelado mantém autoria nula
- [ ] O contrato de carregamento de agenda do dia passa a carregar a autoria junto do motivo
- [ ] O painel exibe a autoria por selo de variante sutil, nunca por fundo sólido; se algum selo usar preenchimento sólido com texto branco, usa o par de tokens sólidos para não repetir o débito de contraste catalogado no design system
- [ ] Autoria ausente é exibida como desconhecida, sem quebrar o cartão e sem adivinhar
- [ ] O texto padrão gravado quando o cliente cancela sem escrever motivo permanece como está, passando a ser apenas texto de preenchimento
- [ ] Teste do repositório: autoria de barbearia no cancelamento pela via do gestor; autoria de cliente na via do Canal do Cliente; cancelado sem autoria volta com autoria nula, sem erro
- [ ] pgTAP: cada uma das três RPCs grava a autoria correta; a restrição de verificação recusa valor fora do domínio; Agendamento não cancelado mantém autoria nula
- [ ] pgTAP: cada RPC alterada ganha asserção de isolamento provando o bloqueio, incluindo o caso do gestor com identificador de barbearia nulo
- [ ] `npm run lint`, `npm test` e `npm run build` passam
