# 03: Agenda do gerente lê Agendamento pelo repositório

**What to build:** prefactor. Hoje existem duas rotas de leitura de Agendamento fazendo a mesma coisa: a Minha Agenda do barbeiro lê pelo repositório do módulo de agenda, e a Agenda do gerente monta uma consulta própria dentro da página, duplicando colunas e filtros. Qualquer campo novo precisa ser acrescentado nos dois lugares, e foi assim que as duas telas divergiram.

Este ticket unifica: a Agenda do gerente passa a ler pelo repositório. Para isso o parâmetro de profissional vira opcional — omitido, devolve os Agendamentos de toda a barbearia no intervalo. Nada muda na tela; é preparação para os tickets seguintes, que precisam de um contrato de leitura só.

Nota de segurança que dispensa verificação nova: o recorte de visibilidade já é garantido pela política de leitura da tabela de Agendamento, que libera a barbearia inteira ao papel de gerente e restringe o papel de barbeiro aos Agendamentos do próprio profissional. Omitir o profissional devolve "tudo o que este usuário pode ver", e não amplia acesso de ninguém.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] O parâmetro de profissional do carregamento de agenda do dia passa a ser opcional
- [ ] Informado, o comportamento atual se mantém: só os Agendamentos daquele profissional
- [ ] Omitido, devolve os Agendamentos da barbearia no intervalo
- [ ] O adaptador real e o adaptador em memória implementam a optionalidade
- [ ] A Agenda do gerente substitui a consulta própria de Agendamento pela chamada ao repositório
- [ ] A filtragem por profissional selecionado continua na tela, por ser estado de interface
- [ ] As demais consultas da Agenda do gerente — profissionais, serviços, clientes, Bloqueios de Horário — não são tocadas
- [ ] Nenhuma mudança visível na Agenda do gerente: mesmos cards, mesma grade, mesmos filtros
- [ ] Nenhuma verificação de papel é acrescentada na aplicação; o recorte continua vindo do banco
- [ ] Teste do repositório cobrindo profissional informado contra profissional omitido
- [ ] Os testes atuais da Agenda do gerente e da Minha Agenda continuam verdes
- [ ] `npm run lint`, `npm test` e `npm run build` passam
