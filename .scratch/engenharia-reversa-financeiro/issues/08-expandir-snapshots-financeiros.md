# 08 — Expandir o modelo para snapshots financeiros

**What to build:** Uma comanda finalizada preserva preço, desconto, valor líquido, custo e comissão de cada item, enquanto registros e leituras antigas continuam funcionando durante a transição.

**Blocked by:** 05 — Finalizar comanda atomicamente; 06 — Reabrir comanda atomicamente.

**Status:** completed

- [x] Consultar pelo MCP o schema, a nulidade e as combinações reais de itens fechados no DEV.
- [x] Confirmar a regra vigente de base de comissão antes de persistir novos snapshots.
- [x] Definir precisão, arredondamento e alocação determinística de centavos residuais.
- [x] Criar migration expansiva e aditiva, sem tornar campos novos obrigatórios para registros antigos.
- [x] Gravar quantidade, preço, bruto, desconto alocado, líquido, custo e comissão dentro da finalização atômica.
- [x] Manter gorjeta separada e não inventar comissão para item sem profissional elegível.
- [x] Garantir que a soma dos itens reconcilie com os totais da comanda.
- [x] Preservar leitura compatível de registros legados.
- [x] Tratar reabertura sem deixar snapshots ativos vinculados a uma venda revertida.
- [x] Aplicar somente no DEV pelo MCP e provar que alterações cadastrais futuras não mudam o snapshot.

**Evidências:** migration `20260910195253_snapshots_financeiros_comandas.sql` aplicada somente no DEV; teste pgTAP `08_snapshots_financeiros.test.sql` aprovado com 31 asserções; regressão dos Tickets 05, 06 e 07 aprovada com 23, 18 e 20 asserções.
