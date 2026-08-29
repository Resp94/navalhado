# Spec 025 — Mensageria, encaixes e comanda

## Problem Statement

Encaixes registrados para horários ou dias passados podem gerar confirmações WhatsApp atrasadas para cliente e barbeiro. O card do encaixe pode ficar visualmente concluído apenas porque o pagamento foi registrado, embora atendimento e comanda ainda não estejam finalizados. A confirmação também precisa exibir o valor do serviço sem quebrar os demais fluxos de mensageria.

## Solution

Preservar a arquitetura atual de mensageria, com UAZAPI, dispatcher, outbox, retry e idempotência, adicionando regras de elegibilidade antes do envio. Confirmações de encaixes passados serão suprimidas para cliente e barbeiro, enquanto encaixes futuros manterão o comportamento atual.

O card somente ficará totalmente verde quando atendimento e comanda estiverem finalizados. A confirmação de criação exibirá o preço cadastrado do serviço por meio do marcador `{valor}`, formatado em BRL.

## User Stories

1. Como gerente, quero registrar encaixes em horários passados quando o fluxo operacional exigir, para manter o histórico real do atendimento. (orig. 21)
2. Como cliente, não quero receber confirmação de um encaixe registrado para um horário já passado, para não receber uma mensagem atrasada e confusa. (orig. 22)
3. Como barbeiro, não quero receber confirmação de um encaixe passado, para não receber uma notificação de um atendimento que já ocorreu. (orig. 23)
4. Como gerente, quero que encaixes futuros mantenham o comportamento de confirmação existente, para não perder notificações úteis. (orig. 24)
5. Como gerente, quero que uma confirmação de encaixe passado seja bloqueada antes do envio, para evitar mensagens tanto ao cliente quanto ao barbeiro. (orig. 25)
6. Como administrador, quero que invocações diretas da Edge Function também respeitem a proteção de encaixe passado, para que o trigger não seja o único ponto de segurança. (orig. 26)
7. Como gerente, quero que um encaixe pendente continue visualmente identificado como encaixe, para diferenciar sua origem operacional. (orig. 27)
8. Como gerente, quero que o selo Pago não deixe sozinho o card totalmente verde, para diferenciar pagamento registrado de atendimento finalizado. (orig. 28)
9. Como gerente, quero que o card fique totalmente verde somente depois de finalizar atendimento e comanda, para que a cor represente conclusão real. (orig. 29)
10. Como gerente, quero que a agenda seja atualizada após finalizar a comanda, para visualizar imediatamente o novo estado do encaixe. (orig. 30)
11. Como cliente, quero receber o valor do serviço na confirmação, para saber quanto foi reservado. (orig. 31)
12. Como gerente, quero que o valor da confirmação venha do preço cadastrado no serviço, para não manter valores duplicados ou fixos. (orig. 32)
13. Como gerente, quero usar `{valor}` em um template personalizado de confirmação, para adaptar a comunicação da barbearia. (orig. 33)
14. Como cliente, quero receber o valor formatado em reais, para interpretar a cobrança sem conversões. (orig. 34)
15. Como gerente, quero que confirmação, reagendamento, cancelamento e lembrete continuem funcionando, para não perder os fluxos atuais ao adicionar o valor. (orig. 35)
16. Como administrador, quero manter a UAZAPI como provider, para não alterar a integração externa que já funciona. (orig. 40)
17. Como administrador, quero manter dispatcher, outbox, retry e idempotência, para evitar regressões de entrega e duplicidade. (orig. 41)
18. Como administrador, quero que as regras respeitem isolamento por tenant, para que uma barbearia nunca utilize configuração ou dado de outra. (orig. 42)
19. Como administrador, quero validar as mudanças primeiro em DEV, para reduzir risco antes de qualquer promoção. (orig. 43)
20. Como administrador, quero migrations versionadas para mudanças no banco, para manter histórico e reprodutibilidade. (orig. 44)
21. Como operador, quero motivos observáveis quando uma mensagem for suprimida, para entender por que um encaixe passado não gerou envio. (orig. 45)
22. Como operador, quero que nenhum telefone completo, token ou secret apareça nos logs, para preservar segurança e privacidade. (orig. 46)
23. Como desenvolvedor, quero que o estado visual do card seja uma decisão pura e testável, para evitar regras divergentes nas duas grades. (orig. 48)

## Implementation Decisions

- A Edge Function `whatsapp-integration` continuará sendo a entrada publicada, preservando provider UAZAPI, dispatcher, outbox, retry, idempotência e observabilidade.
- A elegibilidade de confirmação de encaixe passado será protegida no trigger de origem e no handler da Edge Function, antes do dispatcher.
- A regra usará `is_fitting` e o instante de início do atendimento no timezone do tenant. Encaixes futuros continuam elegíveis conforme as configurações atuais.
- A supressão precisa impedir destinatários cliente e barbeiro e registrar motivo observável sem expor dados sensíveis.
- O card será totalmente verde somente quando o atendimento estiver concluído e a comanda/pagamento estiverem finalizados. O status Pago isolado não basta.
- A atualização visual usará o callback de finalização existente, sem criar uma segunda rotina de fechamento.
- A confirmação de criação poderá renderizar `{valor}` usando `services.price`, com locale `pt-BR` e moeda BRL. O valor não será copiado para uma nova coluna de appointment.
- O marcador será adicionado somente à confirmação de criação; cancelamento, reagendamento, lembrete, boas-vindas, primeiro contato e mensagens para profissionais não receberão o marcador automaticamente.
- Toda alteração de função `SECURITY DEFINER` manterá `search_path` fixo, permissões e isolamento por tenant.
- A correção da regra de slots permanecerá na Spec 023; esta spec cobre apenas a fronteira testável compartilhada e a apresentação do estado do card.
- Toda implementação, teste, consulta de validação e migration desta spec será executada exclusivamente no banco/ambiente DEV. As credenciais de teste devem ser obtidas somente de `docs/credenciais_teste.md`, sem copiar valores para código, fixtures, logs ou documentação.
- Toda migration necessária deverá ser versionada e numerada sequencialmente conforme o padrão existente (`timestamp_descricao_082.sql`, próxima disponível `083`), criada pelo fluxo oficial e aplicada somente em DEV nesta etapa, via MCP.

## Testing Decisions

- O Playwright deve validar cliente e barbeiro com o provider substituído por um coletor de teste/outbox, sem envio real para números externos.
- Deve cobrir encaixe passado, encaixe futuro, chamada direta do handler, ausência de duplicidade/retry indevido e motivo de supressão.
- Deve cobrir os estados pendente, confirmado, em atendimento, pago sem conclusão e concluído com comanda finalizada.
- Deve confirmar que a cor muda após a finalização e que a Agenda se atualiza sem novo fluxo paralelo.
- Deve cobrir preço padrão, preço alterado, preço zero quando permitido, `{valor}`, formatação BRL e compatibilidade de templates antigos.
- Deve preservar testes de confirmação, cancelamento, reagendamento, lembretes, boas-vindas, retorno e mensagens para profissionais.
- Deve verificar isolamento entre tenants e ausência de telefone completo, token ou secret nos logs de teste.
- O checklist executável está em [Playwright 025](../../verificacao-playwright/025-mensageria-encaixes.md).
- O checklist executável está em [Playwright 025](../../verificacao-playwright/025-mensageria-encaixes.md) e deve usar exclusivamente o ambiente DEV.

## Out of Scope

- Trocar a UAZAPI ou reescrever a arquitetura da mensageria.
- Alterar a regra de disponibilidade, grade, duração ou pausa da Spec 023.
- Alterar o destino ou a sessão dos links públicos da Spec 024.
- Fazer o card depender apenas do pagamento.
- Criar coluna de preço no agendamento.
- Corrigir avisos históricos dos advisors sem relação com esta mudança.
- Executar testes, migrations ou validações em produção.

## Further Notes

- O caso de encaixe passado deve ser validado por timestamp do tenant, não pelo relógio local do navegador.
- Os checklists Playwright devem ser executados em DEV com fixtures isoladas e sem modificar dados reais de produção.
- Requisitos de migrations, advisors e segurança são gates de implementação, não autorização para executar alterações diretamente em PROD.
