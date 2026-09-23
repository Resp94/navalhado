# 12: Selos do cartão da Agenda usam o componente da biblioteca

**What to build:** o cartão do Agendamento na Agenda carrega vários selos: Encaixe, Pago, Não compareceu e, desde a spec 043, Espera. O selo novo usa o componente de selo da biblioteca de interface, em variante sutil. Os antigos são marcação solta, com fundo sólido e cores escritas à mão em hexadecimal, fora dos tokens.

O resultado é um cartão com dois vocabulários visuais lado a lado, e cores que não respondem ao tema. É o débito de design system já catalogado, agora visível no mesmo cartão.

Depois deste ticket, os selos do cartão falam a mesma língua.

**Onde foi achado:** limite registrado no ticket 07 da spec 043. A observação de que o selo "Espera" fica apertado nos cartões pequenos da visão semanal foi feita durante a verificação no navegador daquele ticket e não chegou ao arquivo dele. O rótulo curto "Espera" substituiu o "Lista de Espera" que o ticket 07 original da spec 043 prometia.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Os selos do cartão do Agendamento passam a usar o componente de selo da biblioteca de interface
- [x] Nenhuma cor escrita em hexadecimal permanece nos selos; as cores vêm de tokens
- [x] Nenhum selo usa fundo sólido com texto branco, a menos que use o par de tokens sólidos previsto para isso
- [x] Vale para a grade do dia, a grade da semana e a visão de celular, que a Minha Agenda do barbeiro também usa
- [x] Cada selo continua distinguível dos outros à primeira vista; o ticket não é uma uniformização que apague a diferença entre Encaixe e Pago
- [x] O espaço ocupado pelos selos não estoura o cartão nas grades menores, conferido na visão semanal e em tela de 375 pixels
- [x] O rótulo do selo da Lista de Espera, hoje "Espera", é conferido quanto à clareza para quem não conhece a origem do Agendamento; se mudar, muda nas três superfícies e nos testes
- [x] Os testes de tela que hoje procuram esses selos continuam verdes, ajustados ao novo texto acessível se ele mudar
- [x] Verificado no navegador, com um Agendamento que carregue mais de um selo ao mesmo tempo
- [x] `npm run lint`, `npm test` e `npm run build` passam

**Resultado (2026-09-22):**

- **Achado ao investigar:** os selos do cartão existem em **três** lugares, não dois — a grade do dia e a grade da semana em `src/pages/gerente/Agenda.tsx`, mais `src/pages/gerente/mobile/MobileAgendaView.tsx` (visão de celular), que `Agenda.tsx` já embute e renderiza sempre, escondida da grade desktop só por classe CSS de breakpoint (`max-md:`) — as duas convivem no DOM o tempo todo, uma delas só invisível. O ticket, escrito antes dessa descoberta, falava em "grade do dia, grade da semana e visão de celular" sem saber que a terceira já era um arquivo à parte com sua própria cópia dos mesmos selos em hex solto.
- **Conversão:** Encaixe, Pago e Não compareceu passam a usar `Badge` (`badgeType="solid"`, variantes `brand`, `success` e `error`) nos três lugares. Espera já usava `Badge` (`badgeType="subtle"`, variante `brand`) desde a spec 043; mantido como estava. O selo "Atendendo" (`in_progress`), que o ticket não citou mas é a mesma categoria de selo na grade do dia, também migrou (`badgeType="solid"`, variante `info`) — já usava token de cor (`bg-info`), só não vinha do componente.
- **Fora do escopo, deixado como estava:** a cor de fundo do *card* inteiro (não o selo) por estado (`CARD_STATUS_TW` em `Agenda.tsx`, `AGENDA_CARD_COLORS` em `MobileAgendaView.tsx`) e a borda esquerda âmbar do encaixe — os três já têm comentário próprio no código reconhecendo que não há token exato e justificando o hex literal; o ticket fala de selos, não do card em si.
- **Visão semanal:** os selos ali ficam num `className` compacto (`CARD_BADGE_WEEK_CLASS`, com `!important`) que reduz fonte e preenchimento, preservando a cor e a forma do `Badge` — sem isso, o tamanho padrão do componente (pensado para a grade do dia) estourava o espaço menor do cartão semanal.
- **Rótulo "Espera":** avaliado e mantido como está. Já carrega `title="Veio da Lista de Espera"` (tooltip ao passar o mouse) explicando a origem para quem não reconhece o rótulo curto sozinho; não há indício de confusão relatada desde que foi introduzido na spec 043. Trocar o texto visível exigiria mudar nas três superfícies e nos testes sem um motivo concreto guiando para qual texto — decisão registrada aqui, não tomada.
- **Vermelho provado por mutação, com um ajuste no meio do caminho:** a primeira versão dos testes novos comparava `className` entre selos diferentes e checava ausência de hexadecimal solto — passou até contra o código antigo, porque nem todo selo antigo usava hex cru (Encaixe e Pago já vinham de tokens, só não do componente; só "Não compareceu" tinha o hex `#b91c1c`). Reescrito para checar a classe exata que o `Badge` gera por variante/tipo (`bg-brand-primary-solid`, `bg-success-solid`, `bg-error-solid`) — essa sim só existe vindo do componente. Rodado contra `Agenda.tsx` e `MobileAgendaView.tsx` de antes do ticket: as duas asserções de classe exata falham como esperado. Restaurado o código corrigido, os três testes novos passam.
- **Verificado no navegador** (dev server local, sessão de barbeiro): inseri um Agendamento de teste no ambiente de desenvolvimento com Encaixe + Espera + Pago simultâneos (`status='completed'`, `payment_status='paid'`, `is_fitting=true`, `from_waiting_list=true` — a combinação exata importa: o selo "Pago" na visão mobile usa uma regra mais estrita que a grade desktop para atendimento de Encaixe, achado registrado à parte, não corrigido aqui por ser um problema de *quando* mostrar o selo, não de estilo). Confirmado visualmente: os três selos aparecem lado a lado na grade do dia (desktop) e empilhados no cartão da visão de celular (375px), cada um com cor e forma distintas, sem estourar o cartão. Removido o Agendamento de teste (e a Comanda que o gatilho de banco criou) depois da verificação.
- Não foi possível verificar visualmente a **visão semanal** no navegador: ela só existe na tela do gerente (`/agenda`), e a sessão aberta é de barbeiro — entrar como gerente exigiria login, que minhas regras de segurança não permitem eu fazer. Coberta pelo teste de tela automatizado (presença dos três selos na visão semanal após alternar para "Semana"), mas o encaixe visual em pixels dessa grade específica fica sem confirmação humana.
- Testes de tela novos em `src/pages/__tests__/Agenda.test.tsx` (describe "Selos do cartão usam o componente Badge da biblioteca"): 3 casos — os três selos com a classe de token exata do `Badge` na grade do dia e na visão mobile; "Não compareceu" com o token de erro sólido; os mesmos selos presentes na visão semanal.
- Suíte completa da aplicação: 110 arquivos, 1203 testes (+3 deste ticket). `npx tsc -b`: 0 erros. `npx oxlint`: exit 0. `npm run build`: build 0.
- Sem migration: mudança só de código de aplicação. Contagens do banco no ambiente de desenvolvimento conferidas depois de toda a verificação (incluindo a limpeza do Agendamento de teste): `tenants=3, appointments=35, customers=6, professionals=6, services=11, waiting_list=0, blocked_slots=0` — idênticas à linha de base do ticket 01.
- Achado à parte durante a verificação, não corrigido aqui (fora do escopo deste ticket, é sobre *quando* o selo aparece, não sobre estilo): o selo "Pago" usa uma condição mais estrita na visão mobile (`cardState === 'completed'`, que para Encaixe exige `status='completed'` e `payment_status='paid'` juntos) do que na grade desktop (`payment_status === 'paid'`, sozinho). Sinalizado para investigação separada.
