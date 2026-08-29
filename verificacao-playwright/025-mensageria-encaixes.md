# Checklist Playwright — Spec 025: Mensageria, encaixes e comanda

**Objetivo:** implementar testes E2E Playwright para encaixes, confirmações, comanda, card e regressões de mensageria.

## Preparação segura

- [ ] Executar somente no banco/ambiente DEV com tenant e profissionais de teste.
- [ ] Carregar as credenciais somente de `docs/credenciais_teste.md`.
- [ ] Garantir que credenciais não sejam copiadas para código, fixtures, screenshots, traces ou logs.
- [ ] Se houver alteração de banco, criar migration versionada com timestamp, descrição e próximo sufixo numérico sequencial (`082` → `083`), sem reutilizar número.
- [ ] Aplicar e validar a migration somente no banco DEV via MCP.
- [ ] Substituir UAZAPI por mock, coletor de outbox ou endpoint de teste.
- [ ] Garantir que nenhum número externo receba mensagem.
- [ ] Preparar fixtures para cliente, barbeiro, appointment, encaixe e comanda.
- [ ] Preparar segundo tenant para validar isolamento.

## Encaixes e confirmações

- [ ] Criar encaixe em dia passado.
- [ ] Confirmar que não há mensagem de confirmação para o cliente.
- [ ] Confirmar que não há mensagem de confirmação para o barbeiro.
- [ ] Confirmar que o evento suprimido não entra em retry nem gera duplicidade.
- [ ] Confirmar que o motivo da supressão é observável.
- [ ] Criar encaixe em horário passado no dia atual.
- [ ] Repetir a validação usando o timezone do tenant.
- [ ] Criar encaixe futuro e confirmar que a confirmação existente permanece.
- [ ] Invocar o handler direto pelo contexto de teste e confirmar a mesma proteção.

## Card e comanda

- [ ] Confirmar identificação visual de encaixe pendente.
- [ ] Confirmar identificação visual de encaixe confirmado.
- [ ] Confirmar identificação visual durante atendimento.
- [ ] Marcar pagamento como pago sem finalizar atendimento/comanda.
- [ ] Confirmar que o card não fica totalmente verde.
- [ ] Finalizar atendimento e comanda pelo fluxo normal.
- [ ] Confirmar que o card fica totalmente verde somente depois dos dois estados finais.
- [ ] Confirmar atualização da Agenda após a finalização.
- [ ] Confirmar que o estado visual é consistente após recarregar a página.
- [ ] Confirmar que cards normais não mudaram de semântica.

## Valor na confirmação

- [ ] Criar reserva com preço carregado do serviço.
- [ ] Confirmar valor formatado em BRL.
- [ ] Alterar preço do serviço de teste e confirmar que a próxima mensagem acompanha a alteração.
- [ ] Testar preço zero quando permitido.
- [ ] Usar template com `{valor}` e confirmar substituição.
- [ ] Usar template sem `{valor}` e confirmar compatibilidade.
- [ ] Confirmar que o valor não aparece automaticamente em mensagens fora da confirmação de criação.

## Regressão da mensageria

- [ ] Confirmar criação normal de agendamento.
- [ ] Confirmar confirmação normal.
- [ ] Confirmar cancelamento.
- [ ] Confirmar reagendamento.
- [ ] Confirmar lembrete.
- [ ] Confirmar boas-vindas.
- [ ] Confirmar retorno do cliente.
- [ ] Confirmar mensagem para profissional quando elegível.
- [ ] Confirmar retry e idempotência sem duplicidade.
- [ ] Confirmar isolamento entre tenants.
- [ ] Confirmar que logs de teste não exibem telefone completo, token ou secret.

## Critério de conclusão

- [ ] Encaixes passados não geram confirmações para nenhum destinatário.
- [ ] Encaixes futuros continuam funcionando.
- [ ] O card só fica totalmente verde após conclusão real.
- [ ] O valor aparece corretamente na confirmação.
- [ ] Nenhuma regressão é identificada nos fluxos existentes.
- [ ] Nenhuma mensagem real é enviada e nenhum dado de produção é alterado.
- [ ] Nenhum teste, consulta ou migration foi executado em produção.
