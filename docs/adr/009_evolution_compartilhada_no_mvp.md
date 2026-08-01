# Evolution compartilhada durante o MVP

> **Histórico — rejeitada e substituída pela ADR 010.** Não compartilhar provedores entre Dev e Prod; a promoção é sequencial e exige comando explícito.

Durante o MVP, o ambiente dev do Navalhado pode usar a mesma stack Evolution API da producao, com cron e triggers ligados, porque a operacao ainda esta limitada a um beta tester e o risco operacional e aceitavel. A separacao completa da Evolution dev permanece como direcao futura quando houver mais usuarios, mais instancias reais ou maior risco de disparos indevidos.
