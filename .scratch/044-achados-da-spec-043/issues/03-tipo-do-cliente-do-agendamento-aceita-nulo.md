# 03: Tipo do cliente do Agendamento aceita nulo

**What to build:** o Agendamento pode não ter Cliente: o encaixe de balcão cria um atendimento sem cadastro, e a coluna do cliente aceita nulo no banco. O tipo que a aplicação usa para ler Agendamento declara o cliente como obrigatório, o que não corresponde ao dado.

Isso já custou um defeito real na spec 043: o Painel de Cancelados do Dia lia o nome do cliente sem checar e derrubava a Agenda inteira quando havia um cancelamento de balcão no dia. A correção foi pontual, dentro do painel. O tipo continua mentindo, então o próximo lugar que ler o cliente sem checar repete o mesmo defeito, e a verificação de tipos não vai avisar.

Depois deste ticket, o tipo diz a verdade e a verificação de tipos passa a apontar quem precisa tratar o nulo. É prefactor do ticket 14, que acrescenta o telefone ao painel e precisa tratar o Agendamento sem Cliente.

**Onde foi achado:** limite registrado no ticket 05 da spec 043, onde a correção pontual foi feita e a propagação do tipo, medida em seis erros, ficou de fora.

**Blocked by:** None (can start immediately). É prefactor do ticket 14

**Status:** done

- [x] O tipo do cliente no Agendamento lido passa a aceitar nulo, no contrato do módulo de agenda e no tipo da página que o espelha
- [x] Todos os pontos que a verificação de tipos apontar passam a tratar o Agendamento sem Cliente, sem silenciar a checagem com conversão forçada de tipo
- [x] O texto exibido para Agendamento sem Cliente é o mesmo já usado na grade, sem inventar um terceiro rótulo
- [x] Nenhum ponto passa a exibir vazio ou a palavra que representa ausência de valor para o usuário
- [x] Ações que dependem do Cliente, como o atalho de WhatsApp, ficam indisponíveis em vez de quebrar
- [x] O adaptador em memória e os fakes de teste passam a conseguir representar Agendamento sem Cliente
- [x] Teste cobrindo Agendamento sem Cliente em cada superfície que a verificação de tipos apontar
- [x] `npm run lint`, `npm test` e `npm run build` passam

**Resultado (2026-09-22):**

- `AgendamentoDoDia.customer` (contrato do módulo de agenda, `src/modules/agenda/types.ts`) e `Appointment.customer` (tipo espelho de `src/pages/gerente/Agenda.tsx`, reusado por `MinhaAgenda.tsx`) passam a aceitar `null`.
- `npx tsc -b` depois da mudança apontou exatamente 2 erros, os dois em `src/pages/barbeiro/MinhaAgenda.tsx`: o atalho de WhatsApp do `MobileBottomSheet` lia `actionAppointment.customer.phone`/`.name` sem checar, dentro de um `onClick` — a checagem `customer?.phone &&` que guarda a renderização do botão não sobrevive ao fechamento (closure) do `onClick`, então o TypeScript não propaga o estreitamento. Corrigido capturando `actionAppointment.customer` numa constante local com `if (!customer) return;` dentro do handler, sem `!` nem `as`.
- Achado de sobra ao mexer no arquivo: o tipo `CanceladoDoPainel`, em `PainelCanceladosDoDia.tsx`, existia só para reintroduzir o nulo que `AgendamentoDoDia.customer` já tinha por fora do contrato oficial (`Omit<AgendamentoDoDia, 'customer'> & { customer: ... | null }`). Com o tipo de origem já nulável, virou alias idêntico ao original; simplificado para `export type CanceladoDoPainel = AgendamentoDoDia`, mantendo o nome exportado (usado pelos testes) e corrigindo o comentário que explicava a gambiarra.
- O site do adaptador Supabase que mapeia a relação (`Array.isArray(item.customer) ? item.customer[0] : item.customer`) já devolvia `null` quando `customer_id` é nulo; o tipo é que mentia. Nenhuma mudança de runtime foi necessária ali, só o tipo passou a admitir o que já acontecia.
- Nenhum outro ponto do domínio de agenda (`Agenda.tsx`, `MobileAgendaView.tsx`, `PainelCanceladosDoDia.tsx`, adaptadores) precisou de tratamento novo: todos já liam `customer` com `?.` e um texto de reserva (`'Cliente'` na Grade Temporal e na visão de celular; `'Cliente Balcão'` no Painel de Cancelados e na Minha Agenda), apesar do tipo antigo dizer que isso nunca seria preciso. Nenhum desses textos foi alterado — decisão confirmada com o usuário: este ticket é só o prefactor de tipo, não a unificação de texto entre telas, que ficaria fora de escopo e mudaria cópia já testada.
- Testes novos: adaptador real, lendo Agendamento de balcão sem Cliente (`customer: null` na linha simulada) e conferindo que `agenda.appointments[0].customer` volta `null`; e Minha Agenda, abrindo as ações de um Agendamento ativo sem Cliente e conferindo o título "Cliente Balcão", a ausência do botão "Chamar no WhatsApp" e a presença do botão "Reagendar" (nada quebra).
- Builders de teste (`agendamento` em `AgendaRepository.test.ts`, `linha` no adaptador, `appointmentRow` na Minha Agenda) já aceitavam `overrides` por spread; nenhum precisou de mudança para representar `customer: null`, só passaram a fazer sentido contra o tipo.
- Suíte completa: 109 arquivos, 1193 testes (1191 + 2 novos), exit 0. `npx tsc -b`: 0 erros. `npx oxlint`: exit 0, 47 avisos preexistentes. `npm run build`: build 0.

**Nota sobre a checagem por mutação:** desfazer a correção do `onClick` da Minha Agenda (voltando a `actionAppointment.customer!.phone`, com `!`) não derruba o teste novo, porque o botão "Chamar no WhatsApp" já não é renderizado quando `customer` é nulo (`customer?.phone &&` guarda a renderização) — o trecho corrigido nunca é alcançado pela interface, então não é um defeito de runtime alcançável, só um erro de tipo. A correção evita a asserção forçada mesmo assim, porque é o que o critério do ticket pede.
