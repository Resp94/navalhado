# 17: Auditoria dos módulos sem adaptador em memória

**What to build:** a observação da Lista de Espera se perdia a caminho do banco com a suíte verde. A causa de fundo foi o módulo não ter adaptador em memória próprio: o teste usava um dublê declarado dentro do arquivo, mais generoso que a tabela, que guardava o campo que o banco descartava. A spec 043 corrigiu isso na Lista de Espera e registrou que valia conferir os outros módulos.

Numa contagem preliminar feita em 2026-09-22, só 5 dos 16 módulos têm adaptador em memória na pasta de adaptadores. A contagem olhou só o nome do arquivo e pode estar errada nos dois sentidos.

Depois deste ticket, sabe-se quais módulos correm o mesmo risco, e cada um que correr vira ticket próprio.

**Onde foi achado:** notas finais da spec 043.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Para cada módulo, fica registrado se ele tem adaptador em memória, qualquer que seja o nome ou o lugar do arquivo
- [ ] Para cada módulo sem adaptador em memória, fica registrado como o teste do repositório é montado hoje: dublê dentro do arquivo, simulação do cliente do banco, ou nenhum teste de repositório
- [ ] Para cada dublê encontrado, fica registrado se ele guarda algum campo que a tabela real não tem, conferido contra a estrutura do banco no ambiente de desenvolvimento; é esse o padrão que escondeu o defeito da Lista de Espera
- [ ] Todo campo que o tipo de domínio declara e a tabela não tem é listado, como era o carimbo de atualização da Lista de Espera
- [ ] Todo achado com risco de perda silenciosa de dado vira ticket próprio, com o módulo como escopo
- [ ] Este ticket não cria adaptador nem altera código de produção ou de teste; ele só levanta
- [ ] O resultado fica registrado neste ticket, inclusive a correção da contagem preliminar
