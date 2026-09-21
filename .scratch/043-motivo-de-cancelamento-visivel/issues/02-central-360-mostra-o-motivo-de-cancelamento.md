# 02: Central 360º do Cliente mostra o Motivo de Cancelamento

**What to build:** a aba de histórico da Central 360º do Cliente já lista os Agendamentos cancelados daquele cliente, mas mostra apenas a palavra "Cancelado" e para aí. O gerente que abre a ficha para decidir como tratar um cliente que desmarca com frequência não consegue ler por quê. Depois deste ticket, cada entrada cancelada do histórico exibe o Motivo de Cancelamento por extenso, e cancelamentos repetidos do mesmo cliente ficam legíveis num lugar só.

O texto já está gravado no banco desde sempre; o que falta é o contrato de leitura do módulo de clientes carregá-lo.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] O contrato de histórico de Agendamento do módulo de clientes passa a carregar o Motivo de Cancelamento
- [x] O adaptador real e o adaptador em memória do módulo passam a devolver o campo
- [x] A aba de histórico da Central 360º exibe o motivo nas entradas canceladas
- [x] Entrada cancelada sem motivo registrado renderiza sem rótulo vazio e sem ruído visual
- [x] Entrada não cancelada não exibe o campo
- [x] Registros antigos sem motivo continuam sem motivo; nenhum texto é inferido ou inventado
- [x] A autoria do cancelamento fica fora desta tela; aqui o eixo é o que aconteceu com o cliente
- [x] Cor, raio, sombra e fonte por token; nenhum hexadecimal novo
- [x] Presença e ausência do motivo no histórico cobertas por teste do adaptador real, com cliente falso que só devolve as colunas pedidas; sem teste no repositório, que apenas repassa o que o adaptador devolve (ver Verificação)
- [x] Teste de tela da Central 360º provando que o motivo aparece na entrada cancelada e que a ausência não quebra a renderização
- [x] `npm run lint`, `npm test` e `npm run build` passam

**Verificação (2026-09-21):**

- Suíte completa: 109 arquivos, 1133 testes, exit 0. Lint, `tsc` e `npm run build` saem 0. Depois de uma correção final de uma linha (mover o `trim` do motivo da tela para o adaptador), os 38 testes dos arquivos afetados foram refeitos, além de `tsc` e lint; a suíte completa não foi repetida depois dela.
- A consulta do histórico não selecionava a coluna do motivo, que já estava gravada no banco. O teste do adaptador falha quando a coluna é removida da consulta, o que confirma que ele cobre o defeito.
- Navegador, como gerente, no ambiente de desenvolvimento: na Central 360º de um cliente com 4 cancelamentos, 1 exibiu o motivo por extenso e 3 ficaram sem rótulo. O texto longo quebrou em duas linhas sem estourar o cartão. Console sem erros.
- Para exibir o caso com motivo, um texto temporário foi gravado em um Agendamento cancelado existente e revertido para nulo em seguida, conferido no banco.

**Desvios e limites:**

- O critério do teste do repositório foi atendido por substituição. `getHistoricoVisitas` só repassa o que o adaptador devolve, então um teste nele passaria por construção. A cobertura ficou no adaptador real e na tela.
- O adaptador em memória não precisou de alteração: devolve os dados sem transformá-los, e o campo é opcional no tipo.
- Normalização: motivo só com espaços é tratado como ausente e o motivo real é aparado, no adaptador.
- A verificação no navegador exibiu o motivo apenas em cancelamentos com texto gravado; nenhum cancelamento real com motivo escrito por um cliente na barbearia logada foi observado.
