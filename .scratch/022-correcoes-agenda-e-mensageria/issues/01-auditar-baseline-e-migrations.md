# 01 — Auditar baseline dos snapshots e migrations

**What to build:** uma base de validação que registre os fluxos funcionais já confirmados nos snapshots, os seams de teste e o estado de migrations de DEV e PROD antes de qualquer correção.

**Blocked by:** None — can start immediately.

**Status:** done

- [x] Transformar os itens funcionais dos snapshots em uma matriz de regressão para Serviços, Agenda, Comandas, Equipe, Configurações, Canal do Cliente e mensageria.
- [x] Confirmar a branch `dev`, seu HEAD e a ausência de alterações rastreadas inesperadas antes da implementação.
- [x] Comparar o histórico de migrations local, DEV e PROD sem editar, renomear ou reaplicar migrations existentes.
- [x] Identificar se as correções previstas exigem migration nova; caso não exijam, registrar essa decisão.
- [x] Executar os testes focados existentes como baseline e registrar falhas preexistentes separadamente.
- [x] Documentar os seams de Agenda, persistência de templates e dispatcher/Edge Function que serão usados nos tickets seguintes.

## Resultado

- Baseline focado: 6 arquivos e 60 testes aprovados.
- Avisos de teste existentes foram observados em WhatsApp (mock incompleto de `auth.getUser`) e Comandas/Profissionais (`act`/mock de Supabase), sem falha de asserção.
- DEV está na branch `dev`, HEAD `6c5a078`, sincronizada com `origin/dev`.
- A auditoria remota encontrou históricos de migrations com nomes/versões diferentes entre DEV e PROD; nenhuma alteração manual foi feita.
- Para os tickets 02–04 não há migration de schema previamente necessária; qualquer necessidade nova deverá gerar migration própria e ser validada primeiro em DEV.
