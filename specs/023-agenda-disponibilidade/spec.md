# Spec 023 — Agenda e disponibilidade

## Problem Statement

A agenda precisa calcular e exibir horários de forma consistente com as configurações dinâmicas de cada tenant e com a escala individual de cada profissional. Hoje a grade, a duração do serviço, as pausas, o fechamento e a antecedência podem ser interpretados de maneira diferente entre a Agenda, o portal público e o Supabase.

## Solution

Concentrar em um módulo profundo de disponibilidade a regra de que o funcionamento do tenant define a janela máxima e a cadência da grade, enquanto a escala do profissional define a interseção efetivamente atendida. A pausa profissional será uma quebra exata; ao retornar, a grade reinicia no horário configurado e avança pelo intervalo dinâmico do tenant.

A duração efetiva será a duração do serviço ou a duração personalizada para o profissional, quando existir. Ela será usada para término, conflitos, bloqueios e cruzamento com pausas. A antecedência mínima usará o fuso do tenant. O fechamento limitará o início do slot, permitindo que o serviço ultrapasse o horário de fechamento quando o início for válido.

## User Stories

1. Como dono de uma barbearia, quero que a grade use as configurações do meu tenant, para que os horários exibidos correspondam ao funcionamento real. (orig. 1)
2. Como dono de uma barbearia, quero configurar diferentes intervalos de grade, para que cada unidade tenha sua própria cadência. (orig. 2)
3. Como gerente, quero que a grade da tarde reinicie no fim do intervalo, para que o primeiro horário após a pausa seja exatamente o horário de retorno configurado. (orig. 3)
4. Como gerente, quero que os slots seguintes avancem pelo intervalo configurado, para que a sequência não crie horários intermediários indevidos. (orig. 4)
5. Como cliente, quero que a duração personalizada do serviço/profissional seja respeitada, para que a agenda reflita o tempo real do atendimento. (orig. 6)
6. Como gerente, quero permitir que um serviço iniciado antes do fechamento termine depois dele, quando essa for a regra da barbearia. (orig. 7)
7. Como cliente, quero que a antecedência mínima seja aplicada no meu fuso de atendimento, para não conseguir reservar um horário passado ou próximo demais. (orig. 8)
8. Como gerente, quero que o último slot seja calculado dinamicamente, para que ele mude quando abertura, pausa, fechamento, intervalo ou antecedência forem alterados. (orig. 10)
9. Como gerente, quero que um intervalo terminando às 15:00 com grade de 40 minutos produza 18:20 como último início antes das 19:00, para representar a cadência configurada. (orig. 11)
10. Como gerente, quero que uma configuração diferente, como intervalo terminando às 14:00, possa produzir 18:40, para que o sistema não esconda horários por hardcode. (orig. 12)
11. Como gerente, quero que o horário do barbeiro defina a grade efetivamente atendida, respeitando os limites máximos do tenant e a cadência configurada. (orig. 13)
12. Como gerente, quero que a disponibilidade do barbeiro retome após sua pausa no horário configurado e avance pelo intervalo do tenant, para preservar o formato atual. (orig. 18)
13. Como gerente, quero configurar o início e o fim do intervalo do barbeiro em horários exatos dentro do expediente do tenant, independentemente do intervalo da grade, para representar corretamente a operação. (orig. 19)
14. Como gerente, quero que horários de escala e intervalo fora do funcionamento da barbearia sejam rejeitados, para manter o barbeiro dentro dos limites oficiais. (orig. 20)
15. Como desenvolvedor, quero que a regra de slot seja testável em uma fronteira de domínio, para reduzir duplicação entre agenda e portal. (orig. 47)

## Implementation Decisions

- A disponibilidade terá uma única interface de domínio consumida pela Agenda interna e pelo portal público, com adaptadores separados para cada tela.
- `tenants.business_hours` define a janela máxima; `tenants.slot_interval_minutes` define o intervalo da cadência; a escala semanal do profissional define a janela efetiva e a origem de cada segmento.
- O tenant define os limites máximos. A escala do profissional define a janela efetivamente atendida e a origem da cadência no segmento correspondente. No modo `Tanto faz`, a grade é a união das grades dos profissionais compatíveis; cada profissional conserva seu próprio início, fim e retorno de pausa.
- O retorno da pausa profissional será uma origem exata do segmento da tarde. O intervalo da grade não será usado para arredondar os campos de configuração do profissional.
- O serviço escolhido determina a duração base. `professional_services.custom_duration_minutes`, quando definido e habilitado, substitui a duração base para aquele profissional.
- O fechamento limita `slot_start`, não `slot_start + duration`; serviços podem terminar depois do fechamento quando o início for elegível.
- Conflitos com appointments, bloqueios e pausas usam sobreposição temporal real e a duração efetiva.
- A antecedência mínima é calculada com o timezone do tenant e sem valores hardcoded.
- Encaixes continuam como exceção operacional e não alteram a grade normal nem as configurações persistidas.
- A validação autoritativa permanece no Supabase; o frontend não poderá substituir a decisão do backend.
- Toda implementação, teste, consulta de validação e migration desta spec será executada exclusivamente no banco/ambiente DEV. As credenciais de teste devem ser obtidas somente de `docs/credenciais_teste.md`, sem copiar valores para código, fixtures, logs ou documentação.
- Mudanças de banco, caso necessárias, serão migrations versionadas, numeradas sequencialmente conforme o padrão existente (`timestamp_descricao_082.sql`, próxima disponível `083`), criadas pelo fluxo oficial e aplicadas somente em DEV nesta etapa, via MCP.

## Testing Decisions

- O teste principal atravessa a interface do módulo de disponibilidade e compara Agenda interna, portal e confirmação.
- O Playwright deve validar o comportamento percebido pelo usuário com configurações carregadas da fixture do tenant, sem assumir valores fixos.
- Devem ser cobertos: intervalos de 40 e outros valores, retorno às 14:00 e 15:00, último slot, duração base e personalizada, conflitos, bloqueios, antecedência, fechamento e interseção tenant/profissional.
- Com tenant `09:00–19:00`, grade de 40 e profissional com intervalo `12:00–14:00`, salvar e recarregar deve preservar exatamente os dois horários.
- O teste deve confirmar que o slot de `18:20` pode iniciar serviço de 60 minutos e terminar depois das 19:00, sem criar início em `19:00`.
- O checklist executável está em [Playwright 023](../../verificacao-playwright/023-agenda-disponibilidade.md) e deve usar exclusivamente o ambiente DEV.

## Out of Scope

- Alterar o fluxo de links públicos, sessão ou identificação do cliente.
- Alterar mensagens WhatsApp, preço de confirmação ou cor de cards.
- Alterar dados de tenants existentes durante a implementação.
- Executar testes, migrations ou validações em produção.
- Fazer o próximo slot se deslocar automaticamente após cada agendamento; a grade continuará seguindo a regra de retorno e intervalo definida nesta spec.

## Further Notes

- Os valores `14:00`, `15:00`, `18:20`, `18:40` e `19:00` são cenários de teste, não constantes de implementação.
- O tenant define os limites máximos; o profissional define o horário efetivamente atendido.
- O seletor de escala/intervalo e o gerador de slots são conceitos diferentes: uma pausa `12:00–14:00` pode ser salva mesmo que esses horários não estejam na sequência da grade anterior. Um agendamento antigo apenas ocupa seu intervalo real e não desloca a origem da grade.
