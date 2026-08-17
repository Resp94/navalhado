# 04 — Validação Estrita de Link, Salvamento e Disparo de Teste Real

**What to build:** 
A integridade operacional, persistência segura e mecanismo de teste em produção para os templates de WhatsApp. O formulário valida estritamente a presença da tag `{link}` no texto: se a tag for apagada, a interface exibe um banner de aviso em destaque amarelo e bloqueia o botão de salvar, impedindo que notificações sejam enviadas sem a URL de autoatendimento. A persistência no banco Supabase é acionada por um botão explícito "Salvar Modelo" com estados de carregamento e confirmação por Toast. Além disso, o simulador incorpora a ação "📲 Enviar Teste deste Modelo para meu WhatsApp", disparando o texto renderizado do template selecionado via `/send-manual` para o telefone do gerente.

**Blocked by:** 02 — Disparos Automáticos e Webhook de Entrada com Templates Customizados, 03 — Editor Visual Split View e Live Preview do WhatsApp no Painel do Gerente

**Status:** ready-for-agent

- [ ] Banner de alerta visual renderizado condicionalmente quando a tag `{link}` estiver ausente no texto do editor.
- [ ] Bloqueio estrito do botão "Salvar Modelo" enquanto a tag `{link}` não for inserida.
- [ ] Salvamento explícito no Supabase atualizando a respectiva coluna da instância do tenant com feedback por Toast de sucesso/erro.
- [ ] Botão de disparo de teste real integrado ao simulador WhatsApp que envia o template ativo com dados simulados para o número do gerente.
- [ ] Suporte a envio de texto livre mantido no formulário de teste avulso.
- [ ] Testes de componentes React cobrindo o bloqueio do botão na ausência de `{link}`, fluxo de persistência e acionamento do disparo de teste.
