# 08 — Expandir o modelo para snapshots financeiros

**What to build:** Uma comanda finalizada preserva preço, desconto, valor líquido, custo e comissão de cada item, enquanto registros e leituras antigas continuam funcionando durante a transição.

**Blocked by:** 05 — Finalizar comanda atomicamente; 06 — Reabrir comanda atomicamente.

**Status:** ready-for-agent

- [ ] Consultar pelo MCP o schema, a nulidade e as combinações reais de itens fechados no DEV.
- [ ] Confirmar a regra vigente de base de comissão antes de persistir novos snapshots.
- [ ] Definir precisão, arredondamento e alocação determinística de centavos residuais.
- [ ] Criar migration expansiva e aditiva, sem tornar campos novos obrigatórios para registros antigos.
- [ ] Gravar quantidade, preço, bruto, desconto alocado, líquido, custo e comissão dentro da finalização atômica.
- [ ] Manter gorjeta separada e não inventar comissão para item sem profissional elegível.
- [ ] Garantir que a soma dos itens reconcilie com os totais da comanda.
- [ ] Preservar leitura compatível de registros legados.
- [ ] Tratar reabertura sem deixar snapshots ativos vinculados a uma venda revertida.
- [ ] Aplicar somente no DEV pelo MCP e provar que alterações cadastrais futuras não mudam o snapshot.
