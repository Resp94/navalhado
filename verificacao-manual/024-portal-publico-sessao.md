# Checklist de validação manual — Spec 024: Portal público e sessão do cliente

**Objetivo:** validar no navegador integrado, em DEV, a entrada pública por slug, a sessão do cliente e a exibição somente de horários disponíveis.

## Regras da validação

- Usar exclusivamente `https://dev.navalhado.com.br`.
- Obter credenciais somente de `docs/credenciais_teste.md`; não copiar valores para este arquivo, prints, logs ou relatórios.
- Não executar validações, consultas ou migrations em produção.
- Não criar dados reais nem enviar mensagens para contatos externos. Quando uma confirmação for necessária, usar coletor/outbox de teste ou interromper antes do envio.
- Repetir os cenários relevantes em desktop e mobile e salvar prints dos estados comprovados em `verificacao-manual/`.

## Primeiro contato e sessão

- [ ] Abrir o link público usando domínio e slug.
- [ ] Confirmar que a URL nova não contém `?token=`.
- [ ] Confirmar que a URL nova não contém token no caminho.
- [ ] Informar nome e telefone de cliente existente usando somente dados de teste.
- [ ] Confirmar que a sessão identifica o cliente no tenant correto.
- [ ] Informar nome e telefone de cliente novo usando somente dados de teste.
- [ ] Confirmar que nenhum cliente provisório é criado antes da confirmação.
- [ ] Confirmar que a sessão permanece disponível ao navegar entre serviço, profissional e data.
- [ ] Confirmar que o texto de gerenciamento usa `Meus agendamentos` ou `Gerenciar agendamentos`.
- [ ] Abrir um link legado tokenizado e confirmar compatibilidade durante a transição.
- [ ] Registrar print do link por slug e da área de gerenciamento da sessão.

## Fluxos de agendamento

- [ ] Confirmar que `Agendar` mantém a ordem serviços → profissionais → horários disponíveis → confirmação.
- [ ] Confirmar que nome e telefone continuam sendo solicitados na confirmação do fluxo normal.
- [ ] Dentro de `Gerenciar meus agendamentos`, clicar em `Novo agendamento`.
- [ ] Confirmar que o fluxo de novo agendamento mantém a mesma ordem do fluxo normal.
- [ ] Confirmar que nome e telefone da sessão aparecem preenchidos na confirmação.
- [ ] Clicar em `Sair` e confirmar o retorno ao catálogo público sem excluir agendamentos.

## Somente horários disponíveis

- [ ] Abrir o fluxo de novo agendamento.
- [ ] Confirmar que somente horários disponíveis são renderizados.
- [ ] Confirmar que horários ocupados não aparecem como botões inativos.
- [ ] Confirmar que bloqueios e pausas não aparecem como opções acionáveis.
- [ ] Alterar serviço, profissional e data e confirmar que a lista é recalculada.
- [ ] Abrir o fluxo de reagendamento.
- [ ] Confirmar que o agendamento atual é tratado conforme a regra de exclusão.
- [ ] Confirmar que horários indisponíveis também não aparecem no reagendamento.
- [ ] Forçar uma data sem disponibilidade e confirmar o estado vazio com orientação para outra data ou profissional.
- [ ] Confirmar que a Agenda administrativa mantém sua visualização operacional.
- [ ] Registrar prints do estado com horários disponíveis e do estado vazio.

## Revalidação e isolamento

- [ ] Simular outro cliente ocupando o horário antes da confirmação, sem enviar dados reais.
- [ ] Confirmar que a confirmação é rejeitada de forma controlada.
- [ ] Confirmar que nenhum agendamento duplicado é criado.
- [ ] Confirmar que o portal de um slug não acessa dados de outro tenant.
- [ ] Confirmar que telefone normalizado com diferentes formatações identifica o mesmo cliente.

## Links do cliente

- [ ] Confirmar o link público de primeiro contato.
- [ ] Confirmar o link de confirmação.
- [ ] Confirmar o link de cancelamento.
- [ ] Confirmar o link de reagendamento.
- [ ] Confirmar o link de lembrete.
- [ ] Confirmar que todos os novos links usam slug e sessão, sem token exposto.

## Critério de conclusão

- [ ] Novo agendamento e reagendamento exibem somente opções disponíveis.
- [ ] Nenhum botão indisponível é exibido ao cliente.
- [ ] Links novos não expõem token.
- [ ] Links antigos continuam compatíveis.
- [ ] Prints desktop e mobile foram salvos sem dados sensíveis.
- [ ] Nenhum teste envia mensagem real ou altera produção.
