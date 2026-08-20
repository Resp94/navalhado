# 01 — Infraestrutura de Layout Base, Bottom Navigation e Modais Bottom Sheet

**What to build:**
Implementar o ponto de corte de responsividade (`<= 768px`) nos layouts do Gerente e do Barbeiro, disponibilizando a barra de navegação inferior fixa (`MobileBottomNav`) na zona natural do polegar, cabeçalho mobile compacto com sininho de notificações, container e animação para modais no formato gaveta inferior (*Bottom Sheet*), e suporte completo a *safe area insets* de dispositivos iOS e Android. O layout para telas de computador e tablet (`> 768px`) deve permanecer 100% inalterado.

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] `GerenteLayout` e `BarbeiroLayout` alternam a apresentação visual quando o viewport for `<= 768px` vs `> 768px`.
- [ ] Barra inferior fixa (`MobileBottomNav`) renderiza 5 abas para o Gerente (*Agenda*, *Comandas*, *Caixa*, *Clientes*, *Mais*) e 3 abas para o Barbeiro (*Minha Agenda*, *Comissões*, *Perfil*).
- [ ] A barra inferior possui padding inferior dinâmico respeitando `env(safe-area-inset-bottom)`.
- [ ] Container principal de conteúdo recebe padding inferior compensatório para evitar que elementos interativos fiquem cobertos pela barra de navegação.
- [ ] Estrutura base de animação para modais deslizantes a partir da base (*Bottom Sheets*) com alça de arrasto (*drag handle*) e backdrop blur.
- [ ] A navegação superior e a grade ampla do desktop (`> 768px`) permanecem totalmente intactas.
