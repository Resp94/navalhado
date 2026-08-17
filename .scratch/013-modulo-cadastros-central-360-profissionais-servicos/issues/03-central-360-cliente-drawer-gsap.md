# 03 — Central 360 do Cliente (Drawer Lateral GSAP, Tags Coloridas e Métricas de LTV)

**What to build:**
Implementar na tela `/clientes` o Drawer lateral deslizante via GSAP da Central 360 com 3 abas limpas (Dados e Tags, Histórico Unificado de Agendamentos e Comandas, Métricas de LTV e Frequência), filtro rápido por tags e botões de ação direta.

**Blocked by:** 01 — Migração de Banco Versionada 018 (Expansão de Clientes, Serviços e Produtos, Tabela N:N, Drop Payments e RLS Granular)

**Status:** done

- [x] Atualizar o módulo `src/modules/clientes/` com os tipos e métodos para carregar novos campos (`birth_date`, `tags`, `acquisition_channel`, `cpf`) e métricas consolidadas de LTV.
- [x] Construir o Drawer lateral com animação fluida GSAP (`gsap.fromTo` com curva suave), abrindo a partir da seleção de um cliente na tabela sem perder o contexto ao fundo.
- [x] Implementar a **Aba 1 (Dados Cadastrais e Tags)**: edição de dados, seletor visual de tags coloridas (com criação rápida de novas tags) e canal de aquisição.
- [x] Implementar a **Aba 2 (Histórico Unificado)**: listagem cronológica consolidando agendamentos e comandas com detalhamento de serviços e produtos consumidos.
- [x] Implementar a **Aba 3 (Métricas e LTV)**: exibição em cards de Total Investido (LTV), Ticket Médio, Total de Visitas e Frequência Média em dias.
- [x] Implementar ações rápidas no topo do Drawer: botão direto para *Enviar WhatsApp* e atalho para *Nova Comanda*.
- [x] Adicionar barra de filtros por Tags no topo da tabela de clientes.
- [x] Criar testes unitários para a consolidação de métricas e filtros de clientes.
- [x] Realizar validação visual no navegador em `http://localhost:5173/clientes`.

