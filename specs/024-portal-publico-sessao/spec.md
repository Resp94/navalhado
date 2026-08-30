# Spec 024 — Portal público e sessão do cliente

## Problem Statement

O portal público atualmente pode exibir toda a régua de horários, diferenciando disponibilidade por botões ativos e inativos. Isso faz o cliente interpretar horários bloqueados como opções de reserva. Além disso, os links enviados ao cliente precisam iniciar o fluxo pelo tenant correto sem expor token na URL e sem criar clientes fantasmas.

## Solution

Usar o domínio público mais o slug do tenant como porta de entrada. O fluxo de agendamento permanece na sequência atual: serviço, profissional, horário e confirmação com nome e telefone. O botão de gerenciamento inicia ou recupera uma sessão segura no tenant correto; dentro dela, o cliente também pode iniciar um novo agendamento com seus dados já preenchidos. A disponibilidade pública mostrará somente horários acionáveis para o serviço, profissional, data e regras de agenda selecionados, tanto no novo agendamento quanto no reagendamento.

Links antigos tokenizados continuarão sendo aceitos durante a transição, mas novos links não conterão token. A confirmação final continuará sendo revalidada no Supabase para tratar concorrência.

## User Stories

1. Como cliente, quero ver somente horários válidos para o serviço escolhido, para não reservar um horário que conflite com outro atendimento. (orig. 5)
2. Como gerente, quero que o portal público e a agenda interna mostrem a mesma disponibilidade, para evitar informações divergentes. (orig. 9)
3. Como cliente, quero que a grade pública respeite os limites do tenant e o expediente efetivo dos profissionais, para ver apenas horários coerentes com a operação real. (orig. 14)
4. Como cliente no portal público, quero ver somente horários disponíveis no agendamento e no reagendamento, para não interpretar horários bloqueados como opções de reserva. (orig. 15)
5. Como cliente, quero que horários ocupados ou indisponíveis não sejam renderizados como botões inativos, para encontrar rapidamente as opções acionáveis. (orig. 16)
6. Como cliente, quero receber uma indicação clara quando não houver horários disponíveis, para poder escolher outra data ou profissional. (orig. 17)
7. Como cliente em primeiro contato, quero acessar o link público da barbearia pelo slug, para iniciar o agendamento sem depender de token. (orig. 36)
8. Como gerente, quero que o primeiro contato não exponha token de cliente na URL, para simplificar o acesso e reduzir dependência de links personalizados. (orig. 37)
9. Como sistema, quero identificar o cliente por tenant e telefone normalizado após o acesso público, para evitar clientes fantasmas. (orig. 38)
10. Como cliente, quero que confirmação, cancelamento, reagendamento, lembretes e primeiro contato abram pelo slug e iniciem minha sessão, para não receber tokens expostos na URL. (orig. 39)
11. Como cliente com sessão ativa, quero iniciar um novo agendamento pelo gerenciamento e confirmar com nome e telefone preenchidos, sem repetir meus dados.

## Implementation Decisions

- O link público novo terá o domínio da aplicação e o slug do tenant, sem `token` ou segredo na URL.
- O caminho `Agendar` manterá a sequência atual: serviços, profissionais, horários disponíveis e confirmação com nome e telefone.
- O botão `Gerenciar meus agendamentos` será uma entrada separada: solicitará nome e telefone, iniciará/recuperará a sessão segura e abrirá a área de gerenciamento.
- Um cliente com sessão ativa poderá iniciar um novo agendamento pela área de gerenciamento; a confirmação reutilizará nome e telefone preenchidos pela sessão.
- A sessão resolverá o tenant e o cliente fora da URL, usando o fluxo de nome e telefone normalizado já existente.
- A sessão pública usará Supabase Auth anônimo e autorização baseada em `auth.uid()`; nenhum RPC de operação sensível aceitará apenas um identificador público de sessão.
- Usuários criados pelo Supabase Auth com `is_anonymous = true` serão mantidos somente em `auth.users` durante a sessão; o trigger `handle_new_user()` não os projetará em `public.users`, cuja identidade administrativa/profissional exige e-mail.
- Não será criada uma segunda identidade de cliente baseada em URL.
- Links legados tokenizados serão aceitos durante a transição e convertidos para a sessão pública sem quebrar mensagens já entregues.
- As entradas públicas de primeiro contato, confirmação, cancelamento, reagendamento e lembrete usarão o slug; uma ação não secreta poderá ser usada quando necessário.
- A disponibilidade pública não retornará opções indisponíveis para renderização. Linhas com `available = false` não serão transformadas em botões desabilitados.
- A mesma decisão de disponibilidade do Supabase será usada no agendamento e no reagendamento público.
- No modo `Tanto faz`, a grade pública consumirá a grade efetiva dos profissionais compatíveis, sem reancorar os horários na abertura da barbearia; o intervalo e o retorno da pausa continuam dinâmicos.
- Quando não houver horários, o portal apresentará estado vazio com orientação para escolher outra data ou profissional.
- A Agenda administrativa manterá sua visualização operacional, podendo continuar exibindo horários ocupados ou indisponíveis.
- A confirmação do horário será revalidada no servidor para impedir reservas concorrentes.
- Toda implementação, teste, consulta de validação e migration desta spec será executada exclusivamente no banco/ambiente DEV. As credenciais de teste devem ser obtidas somente de `docs/credenciais_teste.md`, sem copiar valores para código, fixtures, logs ou documentação.
- Toda migration necessária deverá ser versionada e numerada sequencialmente conforme o padrão existente; a correção desta etapa é a `087`, aplicada somente em DEV via MCP.

## Testing Decisions

- A validação será feita com testes automatizados existentes do domínio/componentes e com validação manual no navegador integrado, exclusivamente no ambiente DEV.
- A validação manual deve usar uma fixture/tenant de teste com slug, cliente existente, cliente novo, serviço, profissional e datas controladas, sem copiar credenciais para código, logs ou evidências.
- A persistência da sessão deve confirmar no banco DEV que a identidade é anônima, está vinculada ao tenant e ao cliente, e não possui projeção correspondente em `public.users`.
- Devem confirmar que nenhum novo link contém `?token=` ou `/cliente/<token>`.
- Devem cobrir primeiro contato, confirmação, cancelamento, reagendamento e lembrete usando slug e sessão.
- Devem cobrir identificação de cliente existente, cadastro de cliente novo somente na confirmação e isolamento entre tenants.
- Devem cobrir o gerenciamento, o novo agendamento iniciado dentro da sessão, o preenchimento automático de nome/telefone e o retorno ao fluxo normal após `Sair`.
- Devem confirmar que apenas horários disponíveis aparecem no novo agendamento e no reagendamento.
- Devem confirmar que horários indisponíveis não aparecem como botões inativos e que o estado vazio é exibido quando a lista fica vazia.
- Devem simular, quando possível sem mutar dados persistidos, a concorrência ou a revalidação de horário e registrar a resposta controlada sem duplicar agendamento.
- A validação deve ser repetida em desktop e mobile, com prints dos estados relevantes e sem enviar mensagens reais.
- O checklist de validação manual está em [Validação manual 024](../../verificacao-manual/024-portal-publico-sessao.md) e deve usar exclusivamente o ambiente DEV.

## Out of Scope

- Alterar a semântica interna da grade, duração, pausa ou fechamento; esses contratos pertencem à Spec 023.
- Ocultar horários na Agenda administrativa.
- Criar clientes provisórios antes da confirmação.
- Trocar provider ou reescrever a mensageria.
- Executar testes, migrations ou validações em produção.

## Further Notes

- O portal público não precisa desenhar a régua completa. Ele deve receber somente opções acionáveis.
- A ocultação melhora a experiência, mas não substitui a revalidação autoritativa no Supabase.
- A migration `20260830150000_087_skip_public_users_for_anonymous_auth.sql` corrige a compatibilidade entre o Auth anônimo e o trigger legado de criação de usuários; ela não altera o fluxo de gestores/barbeiros nem a semântica da agenda.
- O texto `Meus agendamentos` ou `Gerenciar agendamentos` deve substituir o termo isolado `Histórico` na entrada do cliente.
- O checklist manual deve ser executado em DEV com dados isolados e sem modificar dados reais de produção.
