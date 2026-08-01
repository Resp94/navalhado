# 02 — Expandir a persistência da Instância WhatsApp

**What to build:** Expandir o modelo de dados para representar uma Instância WhatsApp sem acoplamento à Evolution, mantendo o sistema atual funcional enquanto os fluxos são migrados. A expansão deve preparar credenciais exclusivas de backend, os novos estados da Uazapi e registros de idempotência para mensagens recebidas e enviadas.

**Blocked by:** None — can start immediately.

**Status:** completed

- [x] Existe um modelo neutro de Instância WhatsApp associado a exatamente um tenant.
- [x] O banco impede mais de uma Instância WhatsApp por tenant.
- [x] O provedor atual é registrado como `uazapi`.
- [x] Os estados aceitos incluem conectado, conectando, desconectado e hibernado.
- [x] Preferências atuais de confirmação, cancelamento e lembrete possuem os mesmos valores padrão e limites.
- [x] O token individual pode ser usado pelo backend, mas não pode ser selecionado por papéis do frontend.
- [x] Existe um registro neutro com unicidade suficiente para deduplicar eventos recebidos e envios automáticos.
- [x] RLS mantém isolamento por tenant e administração restrita.
- [x] A expansão não remove ainda o modelo legado nem quebra consumidores existentes.
- [x] Testes SQL cobrem constraints, RLS, privilégios de credencial e idempotência.
