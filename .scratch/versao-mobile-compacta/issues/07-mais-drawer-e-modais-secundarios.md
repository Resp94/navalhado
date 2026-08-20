# 07 — Aba "Mais" (Drawer de Configurações, Link Público e Telas Secundárias)

**What to build:**
Desenvolver o 5º botão da Bottom Navigation ("Mais") que abre um drawer deslizante inferior com cópia rápida do link público de agendamento, navegação rápida para as telas de gestão (Equipe, Serviços, Produtos, WhatsApp, Ajustes) e botão de Logout em destaque, além de ajustar o comportamento responsivo das telas secundárias para telas `<= 768px`.

**Blocked by:** 01 — Infraestrutura de Layout Base, Bottom Navigation e Modais Bottom Sheet

**Status:** done

- [x] O 5º botão "Mais" da barra inferior abre o drawer `MobileMaisDrawer` a partir da base de forma fluida.
- [x] O drawer disponibiliza atalho de 1 toque para copiar o link público de agendamento (`/cliente/{tenantSlug}`).
- [x] Lista de atalhos rápidos com ícones e badges para: *Equipe / Profissionais*, *Serviços*, *Produtos*, *WhatsApp*, *Ajustes / Configurações*.
- [x] Botão de Logout destacado e seguro no rodapé do drawer.
- [x] As telas secundárias do Gerente (`Profissionais.tsx`, `Servicos.tsx`, `Produtos.tsx`, `Whatsapp.tsx`, `Configuracoes.tsx`) respondem com paddings e formulários fluidos em `<= 768px`.
