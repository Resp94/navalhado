# 04: Contador de contatos novos no cabeçalho do painel do Proprietário

Parte da spec 056 (Contatos do Site no painel do Proprietário).

**What to build:** a aba Contatos mostra quantas mensagens estão como `novo`, em qualquer tela do painel do Proprietário. Com zero, o contador some. Um formulário enviado no site aparece em até 1 minuto, sem recarregar a página. O contador baixa na hora quando o Proprietário abre ou marca uma mensagem. Com a aba do navegador em segundo plano, o painel não consulta, e ao voltar para ela o contador se atualiza.

**Blocked by:** 03 (Abrir marca como lida, e o Proprietário marca respondida ou não lida)

**Status:** ready

- [ ] `GET /api/admin/contatos/novos` devolve `{ novos }` (`status = 'novo'`), com a mesma guarda das outras rotas
- [ ] Adaptadores e repositório: `contarNovos`
- [ ] Hook do contador:
  - lê ao montar;
  - lê a cada 60 segundos com `visibilityState` visível, e não lê com a aba oculta;
  - lê ao voltar a ficar visível;
  - lê quando o repositório avisa uma mudança
- [ ] Cabeçalho: o contador na aba Contatos, que some com zero; as três abas, o contador e o Sair cabem em 375 px, sem rolagem horizontal
- [ ] Testes:
  - handler do Worker: contagem e guarda;
  - hook com timers falsos e `visibilityState` simulado;
  - cabeçalho: aparece com novos, some com zero, e a aba atual fica marcada
- [ ] Conferido em 375 px e no desktop, no navegador, localmente
- [ ] Gates de lint, Vitest e build passam
