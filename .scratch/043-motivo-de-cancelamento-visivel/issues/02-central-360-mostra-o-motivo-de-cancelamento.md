# 02: Central 360º do Cliente mostra o Motivo de Cancelamento

**What to build:** a aba de histórico da Central 360º do Cliente já lista os Agendamentos cancelados daquele cliente, mas mostra apenas a palavra "Cancelado" e para aí. O gerente que abre a ficha para decidir como tratar um cliente que desmarca com frequência não consegue ler por quê. Depois deste ticket, cada entrada cancelada do histórico exibe o Motivo de Cancelamento por extenso, e cancelamentos repetidos do mesmo cliente ficam legíveis num lugar só.

O texto já está gravado no banco desde sempre; o que falta é o contrato de leitura do módulo de clientes carregá-lo.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] O contrato de histórico de Agendamento do módulo de clientes passa a carregar o Motivo de Cancelamento
- [ ] O adaptador real e o adaptador em memória do módulo passam a devolver o campo
- [ ] A aba de histórico da Central 360º exibe o motivo nas entradas canceladas
- [ ] Entrada cancelada sem motivo registrado renderiza sem rótulo vazio e sem ruído visual
- [ ] Entrada não cancelada não exibe o campo
- [ ] Registros antigos sem motivo continuam sem motivo; nenhum texto é inferido ou inventado
- [ ] A autoria do cancelamento fica fora desta tela; aqui o eixo é o que aconteceu com o cliente
- [ ] Cor, raio, sombra e fonte por token; nenhum hexadecimal novo
- [ ] Teste do repositório de clientes cobrindo presença e ausência do motivo no histórico
- [ ] Teste de tela da Central 360º provando que o motivo aparece na entrada cancelada e que a ausência não quebra a renderização
- [ ] `npm run lint`, `npm test` e `npm run build` passam
