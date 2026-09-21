# 05: Gerente vê o Painel de Cancelados do Dia

**What to build:** o gerente abre o mesmo painel a partir da Agenda e vê os cancelamentos de toda a barbearia no dia selecionado, não só de um profissional. É o que permite responder por que a casa teve cadeira vazia: se as faltas concentram num profissional, num serviço ou num horário, e se vale acionar a Lista de Espera para reocupar o slot.

Reusa o painel criado no ticket 04 sem ramificação por papel: a única diferença é o conjunto de dados passado. O gerente omite o profissional na chamada e recebe a barbearia inteira, porque a política de leitura da tabela já concede isso ao papel dele.

**Blocked by:** 03 (Agenda do gerente lê Agendamento pelo repositório), 04 (Barbeiro vê o Painel de Cancelados do Dia)

**Status:** done

- [x] A Agenda do gerente abre o mesmo painel do ticket 04, sem componente novo e sem ramificação por papel dentro dele
- [x] A chamada omite o profissional e devolve os cancelados de toda a barbearia no dia
- [x] O painel respeita o filtro de profissionais já aplicado na tela, de modo a concordar com o que a grade mostra
- [x] Cancelamento de profissional filtrado fora da grade continua existindo nos dados: limpar o filtro o revela sem recarregar a página
- [x] Controle no cabeçalho do desktop com contador de cancelamentos do dia; o celular não ganhou o controle (ver Verificação)
- [x] Atalho para falar com o cliente no WhatsApp a partir de uma entrada cancelada, para tentar reocupar o horário
- [x] A lista acompanha a troca do dia selecionado
- [x] Agendamento cancelado continua ausente da grade de horários
- [x] O filtro de profissionais é tratado como recorte de leitura, nunca como controle de acesso
- [x] Nenhuma verificação de permissão é acrescentada no painel; o recorte chega aplicado pelo banco
- [x] Teste de tela da Agenda do gerente: abertura do painel, entradas de mais de um profissional na mesma lista, e respeito ao filtro de profissionais
- [x] pgTAP: gerente lendo Agendamento cancelado alcança os de todos os profissionais da própria barbearia, e nenhum papel exceto o proprietário (admin do SaaS, por desenho) alcança cancelado de outra barbearia
- [x] `npm run lint`, `npm test` e `npm run build` passam

**Verificação (2026-09-21):**

- Suíte completa com o código final: 109 arquivos, 1167 testes, exit 0. Lint e build saem 0.
- Testes de tela da Agenda do gerente: contador sem pôr cancelado na grade; entradas de mais de um profissional na mesma lista; respeito ao filtro de equipe e, ao limpá-lo, o cancelado volta sem nova leitura (o teste conta as chamadas à tabela de Agendamentos); só conta o dia selecionado mesmo quando a leitura traz outros dias; visão semanal; troca de dia; atalho de WhatsApp; atalho desabilitado sem telefone; estado vazio; falha distinta de vazio. O fake da página passou a aplicar `eq` e `neq` de status, sem o que ativos e cancelados voltariam as mesmas linhas. As mutações de remover o filtro de equipe e o filtro de dia são mortas exatamente pelos testes correspondentes.
- pgTAP `52_gerente_le_cancelados_da_propria_barbearia`: 8/8 pelo servidor MCP no ambiente de desenvolvimento, dentro de `begin; ... rollback;`, com caso de controle e sem sobras no banco.
- Navegador, como gerente, no ambiente de desenvolvimento: o dia com 6 cancelados exibiu "Cancelados 6". Com um cancelado temporário de um segundo profissional, exibiu "Cancelados 7" com os dois profissionais na mesma lista. Desmarcar um profissional levou a "Equipe (1)", contador 6 e painel só do outro; limpar o filtro levou de volta a 7. Nenhuma leitura nova de Agendamentos na rede durante todo o teste do filtro. A leitura sai em duas consultas, ativos (`neq.canceled`) e cancelados (`eq.canceled`), nenhuma com filtro de profissional. O atalho abriu `wa.me` com o telefone do cliente e `noopener`.
- O cancelado temporário, mais 2 notificações e 1 comanda criadas por gatilhos, foram apagados pelos ids, e as contagens voltaram ao baseline.

**Defeito encontrado na verificação e corrigido:** a Agenda inteira caiu com `Cannot read properties of null (reading 'name')`. `customer_id` aceita nulo no banco (encaixe de balcão sem cliente cadastrado), o tipo de leitura declara `customer` como obrigatório, e o painel lia `customer.name` sem checar. Como a lista era montada mesmo com o painel fechado, um único cancelado assim derrubava a página. O defeito já estava no painel entregue no ticket 04 e afetava também a Minha Agenda do barbeiro. Foi corrigido com testes que reproduziam o crash nas duas páginas, e o painel passa a mostrar "Cliente Balcão", como a grade.

**Limites e desvios:**

- O controle existe só no cabeçalho do desktop. No celular, a visão do gerente (`MobileAgendaView`) ignora as ações do cabeçalho de propósito e não ganhou o botão. O ticket diz "cabeçalho", então foi lido como desktop; se o gerente precisar disso no celular, é um ticket próprio.
- A tela só conhece os profissionais ativos, então o cancelado de um profissional já desativado não aparece, nem com o filtro em "todos", embora o banco o entregue. É coerente com a grade, que também não os mostra, mas contradiz "toda a barbearia" na borda.
- "Nenhum papel alcança cancelado de outra barbearia" vale para gerente e barbeiro (o barbeiro está no pgTAP 51). O `proprietario` é o admin do SaaS e alcança qualquer barbearia por desenho; o pgTAP 52 o documenta com uma asserção explícita.
- O atalho de WhatsApp abre a conversa sem mensagem pré-preenchida, ao contrário do restante do código, que sempre passa texto. Fica como polimento se a recepção quiser uma frase-base.
- O `fetchAppointments` da Agenda do gerente não descarta resposta obsoleta ao trocar de dia rápido, ao contrário da Minha Agenda. Já era assim para os Agendamentos e agora vale também para o contador.
- O tipo `customer` de `AgendamentoDoDia` e de `Appointment` continua declarado como não-nulo. Torná-lo nulável propaga para 6 erros de tipo, incluindo o tipo da própria página, então o painel só passou a aceitar o nulo por conta própria.
- O botão do cabeçalho repete a string de classes do botão "Espera", e o trio de estados de cancelados repete o da Minha Agenda. Não foram extraídos.
