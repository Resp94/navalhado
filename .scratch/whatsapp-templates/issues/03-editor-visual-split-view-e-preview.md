# 03 — Editor Visual Split View e Live Preview do WhatsApp no Painel do Gerente

**What to build:** 
A interface visual interativa de personalização de mensagens na rota `/whatsapp` do painel do Gerente. O gestor tem à disposição uma seção dedicada em Split View com abas para cada um dos 5 eventos canônicos (Confirmação, Reagendamento, Cancelamento, Lembrete e Primeiro Contato). Ao selecionar uma aba, a coluna esquerda apresenta um editor de texto inteligente com contador de caracteres (limite de 2.000), chips de tags dinâmicas clicáveis que inserem as variáveis diretamente na posição do cursor e um botão de restauração do padrão. A coluna direita renderiza em tempo real um balão autêntico do WhatsApp (com verde característico, hora atual e duplo check azul), preenchendo as tags com dados de simulação realistas conforme o gerente digita.

**Blocked by:** 01 — Infraestrutura de Dados e Motor de Fallback Seguro de Mensagens

**Status:** ready-for-agent

- [ ] Card de Personalização de Mensagens em Split View estilizado segundo o Design System do Navalhado (cores da marca, bordas suaves, sombras e tipografia Outfit).
- [ ] Seletor de abas horizontais para os 5 eventos com ícones Hugeicons oficiais e transições visuais fluidas com GSAP.
- [ ] Editor com textarea inteligente, contador de caracteres em tempo real e barra de chips de tags clicáveis (`+ {cliente}`, `+ {barbearia}`, `+ {servico}`, `+ {profissional}`, `+ {data}`, `+ {horario}`, `+ {link}`).
- [ ] Inserção de tags na posição atual do cursor no textarea sem perda de foco.
- [ ] Simulador visual do WhatsApp com renderização em tempo real das variáveis interpoladas a partir de dados de exemplo simulados.
- [ ] Botão "Restaurar Padrão" que recarrega o texto de fábrica canônico na aba ativa com um clique.
- [ ] Testes de componentes React cobrindo a troca de abas, inserção de chips e atualização imediata do balão de preview.
