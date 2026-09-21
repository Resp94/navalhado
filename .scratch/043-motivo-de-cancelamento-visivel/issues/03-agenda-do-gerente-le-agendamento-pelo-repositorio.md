# 03: Agenda do gerente lê Agendamento pelo repositório

**What to build:** prefactor. Hoje existem duas rotas de leitura de Agendamento fazendo a mesma coisa: a Minha Agenda do barbeiro lê pelo repositório do módulo de agenda, e a Agenda do gerente monta uma consulta própria dentro da página, duplicando colunas e filtros. Qualquer campo novo precisa ser acrescentado nos dois lugares, e foi assim que as duas telas divergiram.

Este ticket unifica: a Agenda do gerente passa a ler pelo repositório. Para isso o parâmetro de profissional vira opcional — omitido, devolve os Agendamentos de toda a barbearia no intervalo. Nada muda na tela; é preparação para os tickets seguintes, que precisam de um contrato de leitura só.

Nota de segurança que dispensa verificação nova: o recorte de visibilidade já é garantido pela política de leitura da tabela de Agendamento, que libera a barbearia inteira ao papel de gerente e restringe o papel de barbeiro aos Agendamentos do próprio profissional. Omitir o profissional devolve "tudo o que este usuário pode ver", e não amplia acesso de ninguém.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] O parâmetro de profissional do carregamento de agenda do dia passa a ser opcional
- [x] Informado, o comportamento atual se mantém: só os Agendamentos daquele profissional
- [x] Omitido, devolve os Agendamentos da barbearia no intervalo
- [x] O adaptador real e o adaptador em memória implementam a optionalidade
- [x] A Agenda do gerente substitui a consulta própria de Agendamento pela chamada ao repositório
- [x] A filtragem por profissional selecionado continua na tela, por ser estado de interface
- [x] As demais consultas da Agenda do gerente — profissionais, serviços, clientes, Bloqueios de Horário — não são tocadas
- [x] Nenhuma mudança visível na Agenda do gerente: mesmos cards, mesma grade, mesmos filtros; a exceção é a falha na leitura de Bloqueios, que agora também esconde os Agendamentos (ver Verificação e ticket 08)
- [x] Nenhuma verificação de papel é acrescentada na aplicação; o recorte continua vindo do banco
- [x] Teste do repositório cobrindo profissional informado contra profissional omitido
- [x] Os testes atuais da Agenda do gerente e da Minha Agenda continuam verdes
- [x] `npm run lint`, `npm test` e `npm run build` passam

**Verificação (2026-09-21):**

- Suíte completa: 109 arquivos, 1139 testes, exit 0. Lint e build saem 0. Depois disso só um comentário foi alterado, e `tsc` sai 0.
- Testes novos: repositório contra o adaptador em memória (omitido, informado, em branco) e adaptador real com um banco falso que aplica os filtros de verdade. O vermelho foi provado antes da implementação.
- Navegador, como gerente, no ambiente de desenvolvimento: dia com 6 ativos e 6 cancelados exibiu só os 6 ativos; dia com dois profissionais exibiu os dois na mesma leitura; a semana exibiu 10 cartões, iguais aos 10 ativos do banco no fuso da barbearia. Console sem erros.
- Rede: a leitura de Agendamentos é uma consulta com filtro de barbearia e exclusão de cancelados, sem filtro de profissional.

**Decisão além do ticket:** só `undefined` significa "omitido". Profissional em branco continua recusado, para um erro de tela não virar leitura da barbearia inteira em silêncio.

**Dívida conhecida, tratada no ticket 08:** o carregamento da agenda do dia também consulta os Bloqueios de Horário, e a página manteve a própria consulta, como o ticket mandava. Medido na rede, isso faz duas consultas à tabela de Bloqueios por leitura, uma delas descartada. Além disso, uma falha na consulta de Bloqueios feita dentro do carregamento agora derruba também os Agendamentos, o que antes era isolado.

**Limites:** a revisão de código apontou que a Agenda do gerente não teria teste de página para a leitura. Isso é impreciso: `src/pages/__tests__/Agenda.test.tsx` mocka a tabela de Agendamentos e afirma que ela é lida, e continuou verde.
