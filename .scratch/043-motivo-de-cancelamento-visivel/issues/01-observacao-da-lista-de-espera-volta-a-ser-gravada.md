# 01: Observação da Lista de Espera volta a ser gravada e lida

**What to build:** a recepção anota uma restrição ao colocar o cliente na Lista de Espera — "só depois das 18h", "quer o Marcos, aceita esperar" — e essa anotação passa a sobreviver. Hoje o campo é coletado pela gaveta e descartado em silêncio, porque a coluna nunca existiu na tabela. Depois deste ticket: a recepção digita, fecha a gaveta, reabre e o texto está lá; e ao usar o encaixe de um clique, a anotação viaja junto para a nota do Agendamento, chegando ao barbeiro que vai atender.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] A tabela da Lista de Espera ganha coluna de observação, texto anulável, sem valor padrão
- [ ] O adaptador passa a incluir a observação na carga de inserção
- [ ] O adaptador passa a copiar a observação ao mapear a linha para entidade
- [ ] O tipo de domínio declara a observação; o carimbo de atualização que o tipo declara e a tabela não tem é removido do tipo, e não criado no banco
- [ ] O módulo ganha adaptador em memória próprio, espelhando apenas os campos realmente persistidos
- [ ] O teste do repositório passa a usar esse adaptador em memória; o dublê declarado dentro do arquivo de teste é removido
- [ ] Entrada adicionada com observação devolve o texto ao ser listada
- [ ] Entrada adicionada sem observação devolve ausência de observação, sem erro e sem texto inventado
- [ ] A observação sobrevive à mudança de status da entrada
- [ ] A obrigatoriedade do nome do cliente continua valendo
- [ ] O cartão da gaveta exibe a observação salva; entrada sem observação renderiza limpa, sem rótulo vazio
- [ ] O encaixe criado a partir de uma entrada com observação produz Agendamento cuja nota contém o texto da recepção, e não apenas o marcador genérico de origem
- [ ] Entradas criadas antes deste ticket permanecem sem observação; nenhum backfill
- [ ] pgTAP: a coluna existe e aceita texto; inserção e leitura devolvem o mesmo texto sem truncamento; ausência de observação resulta em nulo, não em texto vazio; a entrada permanece isolada por barbearia
- [ ] `npm run lint`, `npm test` e `npm run build` passam
