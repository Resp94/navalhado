# Checklist Playwright — Spec 024: Portal público e sessão do cliente

**Objetivo:** implementar testes E2E Playwright para entrada pública, sessão do cliente e exibição exclusiva de horários disponíveis.

## Preparação

- [ ] Apontar o Playwright exclusivamente para o ambiente DEV.
- [ ] Carregar as credenciais somente de `docs/credenciais_teste.md`.
- [ ] Garantir que credenciais não sejam copiadas para código, fixtures, screenshots, traces ou logs.
- [ ] Se houver alteração de banco, criar migration versionada com timestamp, descrição e próximo sufixo numérico sequencial (`082` → `083`), sem reutilizar número.
- [ ] Aplicar e validar a migration somente no banco DEV via MCP.
- [ ] Configurar fixture de tenant com slug, cliente existente, cliente novo, serviço, profissional e datas controladas.
- [ ] Configurar um segundo tenant para validar isolamento.
- [ ] Interceptar ou coletar chamadas de confirmação sem enviar mensagens reais.
- [ ] Garantir que os dados de teste não dependam de clientes reais.

## Primeiro contato e sessão

- [ ] Abrir o link público usando domínio e slug.
- [ ] Confirmar que a URL nova não contém `?token=`.
- [ ] Confirmar que a URL nova não contém token em caminho.
- [ ] Informar nome e telefone de cliente existente.
- [ ] Confirmar que a sessão identifica o cliente no tenant correto.
- [ ] Informar nome e telefone de cliente novo.
- [ ] Confirmar que nenhum cliente provisório é criado antes da confirmação do agendamento.
- [ ] Confirmar que a sessão permanece disponível ao navegar entre serviço, profissional e data.
- [ ] Confirmar que o texto de gerenciamento usa `Meus agendamentos` ou `Gerenciar agendamentos`.
- [ ] Abrir link legado tokenizado e confirmar compatibilidade durante a transição.

## Somente horários disponíveis

- [ ] Abrir o fluxo de novo agendamento.
- [ ] Confirmar que somente horários disponíveis são renderizados.
- [ ] Confirmar que horários ocupados não aparecem como botões inativos.
- [ ] Confirmar que bloqueios e pausas não aparecem como opções acionáveis.
- [ ] Alterar serviço/profissional/data e confirmar que a lista é recalculada.
- [ ] Abrir o fluxo de reagendamento.
- [ ] Confirmar que o agendamento atual é tratado conforme a regra de exclusão.
- [ ] Confirmar que horários indisponíveis também não aparecem no reagendamento.
- [ ] Forçar uma data sem disponibilidade e confirmar estado vazio orientando outra data ou profissional.
- [ ] Confirmar que a Agenda administrativa não perde sua visualização operacional.

## Revalidação e isolamento

- [ ] Simular outro cliente ocupando o horário antes da confirmação.
- [ ] Confirmar que a confirmação é rejeitada de forma controlada.
- [ ] Confirmar que nenhum agendamento duplicado é criado.
- [ ] Confirmar que o portal de um slug não acessa dados de outro tenant.
- [ ] Confirmar que telefone normalizado com diferentes formatações identifica o mesmo cliente.

## Links do cliente

- [ ] Confirmar link público de primeiro contato.
- [ ] Confirmar link de confirmação.
- [ ] Confirmar link de cancelamento.
- [ ] Confirmar link de reagendamento.
- [ ] Confirmar link de lembrete.
- [ ] Confirmar que todos os novos links usam slug e sessão, sem token exposto.

## Critério de conclusão

- [ ] Novo agendamento e reagendamento exibem somente opções disponíveis.
- [ ] Nenhum botão indisponível é exibido ao cliente.
- [ ] Links novos não expõem token.
- [ ] Links antigos continuam compatíveis.
- [ ] Nenhum teste envia mensagem real ou altera produção.
- [ ] Nenhum teste, consulta ou migration foi executado em produção.
