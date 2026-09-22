# 01: Provas de banco da spec 043

**What to build:** a spec 043 foi declarada verde com testes de banco que não foram reexecutados depois da última mudança, e com a suíte da aplicação não repetida depois dos ajustes finais de dois tickets. Nenhuma dessas lacunas indica defeito conhecido, mas várias funções que elas cobrem vão ser alteradas por esta spec, e as mesmas migrations vão para produção.

Mexer numa função cujo teste ninguém executou mistura dois problemas: o que já estava quebrado e o que a mudança quebrou. Este ticket fixa a linha de base antes de qualquer alteração e antes de produção.

Depois deste ticket, sabe-se que o estado atual do banco de desenvolvimento passa nos testes que a spec 043 tocou, ou cada falha virou defeito registrado.

**Onde foi achado:** limites registrados nos tickets 02, 04, 06 e 07 da spec 043.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Todos os testes de banco que a spec 043 criou, alterou ou cujas funções ela alterou são executados inteiros no estado atual do ambiente de desenvolvimento: 17, 18, 32, 42, 46, 50, 51, 52, 53 e 54. Cada um passa ou vira defeito registrado
- [ ] Em especial: o 46 depois do ajuste de mensagem do ticket 07 da spec 043; o 32 depois da migration de autoria; e o 17 inteiro, do qual o ticket 06 da spec 043 só conferiu as asserções da função da Comanda
- [ ] A suíte completa de testes da aplicação é executada uma vez no estado atual da branch de desenvolvimento, e passa
- [ ] Todo teste de banco roda dentro de `begin; ... rollback;`, e as contagens do banco são conferidas antes e depois para provar que nada ficou para trás
- [ ] Nenhum teste de banco é executado contra produção
- [ ] Toda falha encontrada vira defeito registrado, com o teste e a asserção que falharam; o ticket que alteraria a função coberta por esse teste não começa enquanto a falha não for resolvida ou explicada
- [ ] O resultado de cada item é registrado neste ticket, inclusive os que falharem
