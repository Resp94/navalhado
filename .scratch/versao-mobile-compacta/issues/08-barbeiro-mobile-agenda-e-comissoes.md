# 08 — Área do Barbeiro Mobile (Minha Agenda, Minhas Comissões e Perfil)

**What to build:**
Implementar a visão mobile dedicada do Barbeiro (`<= 768px`) com navegação inferior de 3 abas (*Minha Agenda*, *Comissões*, *Perfil/Sair*), exibição simplificada dos agendamentos do profissional, histórico e extrato de comissões ganhas/pendentes com double-bezel luxo, e botão direto de logout.

**Blocked by:** 01 — Infraestrutura de Layout Base, Bottom Navigation e Modais Bottom Sheet

**Status:** done

- [x] Layout do Barbeiro (`BarbeiroLayout.tsx`) renderiza cabeçalho mobile compacto e barra inferior de 3 abas (*Minha Agenda*, *Comissões*, *Perfil / Sair*).
- [x] Aba *Minha Agenda* (`MinhaAgenda.tsx`) exibe cards verticais dos agendamentos do colaborador com status e botão de WhatsApp direto.
- [x] Aba *Comissões* (`MinhasComissoes.tsx`) apresenta cartões de resumo (Total a Receber, Pago, Pendente) e lista de serviços prestados de forma limpa.
- [x] Botão e fluxo de Logout direto a partir da barra inferior ou drawer de perfil.
- [x] Acessibilidade e ergonomia mobile com alvos de toque mínimos de 44x44px.
