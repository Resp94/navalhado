# 04: Contador de contatos novos no cabeçalho do painel do Proprietário

Parte da spec 056 (Contatos do Site no painel do Proprietário).

**What to build:** a aba Contatos mostra quantas mensagens estão como `novo`, em qualquer tela do painel do Proprietário. Com zero, o contador some. Um formulário enviado no site aparece em até 1 minuto, sem recarregar a página. O contador baixa na hora quando o Proprietário abre ou marca uma mensagem. Com a aba do navegador em segundo plano, o painel não consulta, e ao voltar para ela o contador se atualiza.

**Blocked by:** 03 (Abrir marca como lida, e o Proprietário marca respondida ou não lida)

**Status:** done

- [x] `GET /api/admin/contatos/novos` devolve `{ novos }` (`status = 'novo'`), com a mesma guarda das outras rotas
- [x] Adaptadores e repositório: `contarNovos`
- [x] Hook do contador:
  - lê ao montar;
  - lê a cada 60 segundos com `visibilityState` visível, e não lê com a aba oculta;
  - lê ao voltar a ficar visível;
  - lê quando o repositório avisa uma mudança
- [x] Cabeçalho: o contador na aba Contatos, que some com zero; as três abas, o contador e o Sair cabem em 375 px, sem rolagem horizontal
- [x] Testes:
  - handler do Worker: contagem e guarda;
  - hook com timers falsos e `visibilityState` simulado;
  - cabeçalho: aparece com novos, some com zero, e a aba atual fica marcada
- [x] Conferido em 375 px e no desktop, no navegador, localmente
- [x] Gates de lint, Vitest e build passam

**Resultado (2026-10-09):**
- O número fica no canto da aba (posição absoluta) para não alargar o cabeçalho; o leitor de tela ouve "Contatos, N contatos novos" (singular com 1), e acima de 99 aparece "99+".
- Se uma leitura falha, o contador mantém o último número (é um aviso auxiliar; o e-mail para contato@ continua).
- Conferido localmente contra o D1 de dev: com 2 novas, o Dashboard mostrou 2; uma mensagem inserida às 20:14:12 apareceu no contador às 20:15:03, sem recarregar; abrir a mensagem baixou o contador de 3 para 2 na hora; em 375 px o documento ficou com 375 px e o Sair termina em 363 px.
- Ficou no D1 de dev uma terceira mensagem de teste (`terceira-056@exemplo.com`, agora `lido`).
