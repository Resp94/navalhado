# Checklist de validação manual — Spec 025: Mensageria, encaixes e comanda

**Objetivo:** validar no navegador integrado, em DEV, as regras de confirmação de encaixes, estado visual do card, comanda e valor na confirmação.

## Regras da validação

- Usar exclusivamente `https://dev.navalhado.com.br` e dados isolados de teste.
- Obter credenciais somente de `docs/credenciais_teste.md`; não copiar valores para este arquivo, prints, logs ou relatórios.
- Usar coletor/outbox de teste quando houver confirmação; nenhum número externo pode receber mensagem.
- Não executar validações, consultas ou migrations em produção.
- Repetir os estados visuais relevantes em desktop e mobile e salvar prints em `verificacoes/`.

## Encaixes e confirmações

- [ ] Criar ou consultar um encaixe em dia passado no ambiente de teste.
- [ ] Confirmar que não há mensagem de confirmação para o cliente.
- [ ] Confirmar que não há mensagem de confirmação para o barbeiro.
- [ ] Confirmar que o evento suprimido não entra em retry nem gera duplicidade.
- [ ] Confirmar que o motivo da supressão é observável sem telefone completo, token ou secret.
- [ ] Repetir a validação para encaixe em horário passado no dia atual.
- [ ] Repetir a validação respeitando o timezone do tenant.
- [ ] Criar ou consultar um encaixe futuro e confirmar que a confirmação existente permanece.
- [ ] Quando o contexto DEV permitir, invocar o handler por seu fluxo de teste e confirmar a mesma proteção.

## Card e comanda

- [ ] Confirmar identificação visual de encaixe pendente.
- [ ] Confirmar identificação visual de encaixe confirmado.
- [ ] Confirmar identificação visual durante atendimento.
- [ ] Marcar pagamento como pago sem finalizar atendimento/comanda.
- [ ] Confirmar que o card não fica totalmente verde.
- [ ] Finalizar atendimento e comanda pelo fluxo normal de teste.
- [ ] Confirmar que o card fica totalmente verde somente depois dos dois estados finais.
- [ ] Confirmar atualização da Agenda após a finalização.
- [ ] Confirmar que o estado visual permanece correto após recarregar a página.
- [ ] Confirmar que cards normais não mudaram de semântica.
- [ ] Registrar prints do card pendente, pago sem conclusão e totalmente concluído.

## Valor na confirmação

- [ ] Criar uma reserva de teste com preço carregado do serviço.
- [ ] Confirmar o valor formatado em BRL no coletor/outbox de teste.
- [ ] Alterar o preço do serviço de teste e confirmar que a próxima mensagem acompanha a alteração.
- [ ] Testar preço zero quando permitido.
- [ ] Usar template com `{valor}` e confirmar substituição.
- [ ] Usar template sem `{valor}` e confirmar compatibilidade.
- [ ] Confirmar que o valor não aparece automaticamente em mensagens fora da confirmação de criação.
- [ ] Registrar print da confirmação com o valor, sem dados sensíveis.

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
- [ ] Prints desktop e mobile foram salvos sem dados sensíveis.
- [ ] Nenhuma mensagem real é enviada e nenhum dado de produção é alterado.
