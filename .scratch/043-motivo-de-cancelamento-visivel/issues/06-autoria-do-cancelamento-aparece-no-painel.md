# 06: Autoria do cancelamento aparece no painel

**What to build:** diante de um horário vago, a primeira pergunta do gerente é "o cliente desmarcou ou fomos nós?". Hoje isso é irrecuperável: não existe coluna de autoria, as RPCs de cancelamento não registram autor, e o único indício é o texto padrão gravado quando o cliente não escreve motivo — indício que some no instante em que o cliente escreve um motivo de verdade.

Depois deste ticket, cada Agendamento cancelado guarda quem cancelou, e o Painel de Cancelados do Dia mostra isso ao lado do motivo. A distinção é entre barbearia e cliente.

Decisão consciente de não separar gerente de barbeiro: as duas telas chamam a mesma RPC e o banco não identifica o autor individual ali. Separar exigiria propagar identidade de usuário por um caminho que não existe, e "barbearia contra cliente" é a distinção que responde à pergunta operacional.

**Blocked by:** 04 (Barbeiro vê o Painel de Cancelados do Dia)

**Status:** done

- [x] A tabela de Agendamento ganha coluna de autoria do cancelamento, com domínio fechado validado por restrição de verificação, anulável
- [x] A RPC de cancelamento pelo gestor — usada pela Agenda do gerente e pela Minha Agenda do barbeiro — grava autoria de barbearia
- [x] As duas RPCs do Canal do Cliente, a por token e a por sessão pública, gravam autoria de cliente
- [x] A autoria é gravada mesmo quando o cliente escreve um motivo próprio, de modo que a distinção não dependa do texto padrão
- [x] A coluna é escrita pelas RPCs e nunca pela tela; o banco não impede um `UPDATE` direto do gerente pela política existente (ver Verificação)
- [x] Nenhum backfill: Agendamento cancelado antes deste ticket fica com autoria nula
- [x] Agendamento não cancelado mantém autoria nula
- [x] O contrato de carregamento de agenda do dia passa a carregar a autoria junto do motivo
- [x] O painel exibe a autoria por selo de variante sutil, nunca por fundo sólido; se algum selo usar preenchimento sólido com texto branco, usa o par de tokens sólidos para não repetir o débito de contraste catalogado no design system
- [x] Autoria ausente é exibida como desconhecida, sem quebrar o cartão e sem adivinhar
- [x] O texto padrão gravado quando o cliente cancela sem escrever motivo permanece como está, passando a ser apenas texto de preenchimento
- [x] Autoria de barbearia pela via do gestor e de cliente pela via do Canal do Cliente provadas pelo pgTAP contra as RPCs reais; cancelado sem autoria volta com autoria nula, sem erro, provado no adaptador real. Sem teste de repositório, que passaria por construção (ver Verificação)
- [x] pgTAP: cada uma das três RPCs grava a autoria correta; a restrição de verificação recusa valor fora do domínio; Agendamento não cancelado mantém autoria nula
- [x] pgTAP: cada RPC alterada ganha asserção de isolamento provando o bloqueio, incluindo o caso do gestor com identificador de barbearia nulo
- [x] `npm run lint`, `npm test` e `npm run build` passam

**Verificação (2026-09-21):**

- Suíte completa: 109 arquivos, 1170 testes, exit 0. Lint, `tsc` e build saem 0.
- Migration aplicada no ambiente de desenvolvimento. As permissões de execução das quatro RPCs ficaram idênticas às de antes (`anon` só na do token, `authenticated` nas quatro), com `SECURITY DEFINER` e `search_path` preservados. Nenhum dos 9 cancelamentos existentes ganhou autoria: sem backfill.
- pgTAP `53_autoria_do_cancelamento`: 25/25 pelo servidor MCP, dentro de `begin; ... rollback;`, sem sobras no banco. Cobre as quatro gravações, a autoria com motivo próprio do cliente, o domínio fechado, Agendamento não cancelado com autoria nula, e o isolamento de cada RPC, incluindo o gerente com barbearia nula.
- Regressão: o pgTAP 18 passou inteiro, as asserções do 17 sobre a RPC da Comanda passaram, e o 42 passou 13/13 depois de dois consertos (abaixo).
- Testes de aplicação: o adaptador real, com o banco falso que respeita as colunas do `select`, falha quando `canceled_by` sai da consulta; as duas páginas cobrem o selo para cliente, barbearia e autoria nula.
- Navegador, como gerente, no ambiente de desenvolvimento: um Agendamento cancelado pela RPC do gestor apareceu como "Barbearia" e outro, cancelado pelo token, como "Cliente", cada um com o motivo que foi escrito. Os 6 cancelamentos anteriores de um dia apareceram todos como "Desconhecido". Os dois Agendamentos de teste, 8 notificações e 2 comandas criadas por gatilhos foram apagados pelos ids, e as contagens voltaram ao baseline.

**Incidente durante a verificação, com efeito externo:** para exercitar a RPC do gestor pelo banco real, inseri os dois Agendamentos de teste já ativos (`confirmed`), com um cliente real, numa barbearia cuja instância de WhatsApp do ambiente de desenvolvimento estava conectada. Os gatilhos enfileiraram 4 mensagens (2 de confirmação e 2 de cancelamento) e o worker as processou na hora, com sucesso, para o telefone desse cliente. Isso não se desfaz. As 4 linhas do outbox foram mantidas de propósito, como registro do que foi enviado. Nos testes anteriores os Agendamentos eram inseridos já cancelados, o que não dispara evento. A lição foi registrada na memória do projeto.

**Desvios e limites:**

- **Quatro caminhos, não três.** Além das três RPCs previstas, a `cancel_comanda_appointment`, usada pela tela de Comandas para cancelar a Comanda e o Agendamento juntos, também grava `canceled` e não gravava nem motivo nem autoria. Foi incluída: deixá-la de fora faria um cancelamento da barbearia aparecer como desconhecido, que é a pergunta que o ticket quer responder. Ela continua sem gravar o motivo do cancelamento.
- Teste de repositório: um teste ali passaria por construção, porque o fake devolve o que foi semeado, e o lado do cliente não é observável pelo portal. A escrita é provada pelo pgTAP contra as RPCs reais, e a leitura e a exibição pelos testes do adaptador e das páginas.
- "Escrita exclusivamente pelas RPCs": a tela não escreve a coluna e as RPCs são o único caminho da aplicação, mas o banco não impede um `UPDATE` direto, porque a política de atualização de Agendamento permite ao gerente atualizar linhas da própria barbearia.
- Não distingue gerente de barbeiro: as duas telas chamam a mesma RPC e o banco não identifica o autor individual ali.
- A migration está aplicada só no ambiente de desenvolvimento. Produção continua sem a coluna, e o código que a lê já estará em `dev`.
- O pgTAP 42 estava quebrado antes deste ticket por dois motivos antigos: o fixture inseria seis Agendamentos ativos no mesmo instante e violava o índice de um encaixe por horário (spec 040, ticket 09), e a expectativa de que o barbeiro não cancela era anterior à spec 041. Ambos foram consertados em commit próprio. O pgTAP 32 não foi reexecutado.
- Cancelamento pelo Canal do Cliente não foi exercitado pela tela pública; foi provado pelas RPCs reais e pela leitura no painel.
