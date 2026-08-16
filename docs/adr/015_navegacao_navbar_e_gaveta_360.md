# ADR 015: Padrão de Navegação por Navbar Superior e Drawer Central 360

## Contexto e Problema
A interface do Gerente no Navalhado precisa acomodar os novos sub-módulos de cadastros (Clientes 360, Profissionais e Serviços N:N, Produtos e Estoque) mantendo alta densidade de informação, ergonomia operacional e conformidade estrita com o Design System Amber do projeto.

## Decisões Tomadas

1. **Navegação Superior Horizontal na Navbar**:
   - A barra superior do `GerenteLayout` concentra todos os acessos principais de forma horizontal.
   - Substituição total de emojis por ícones vetoriais da biblioteca oficial `@hugeicons/core-free-icons` e `@hugeicons/react`.
   - Adicionada a rota de Produtos (`/produtos`) com `PackageIcon`.

2. **Central 360 em Drawer Lateral com GSAP**:
   - Ao selecionar um cliente na tabela de clientes, a Central 360 abre através de um Drawer lateral deslizante (gaveta direita com animação GSAP), preservando a tabela de contexto ao fundo.
   - Organização em 3 abas:
     - Aba 1: Dados Cadastrais, Canal de Aquisição e Tags coloridas.
     - Aba 2: Histórico Unificado de Agendamentos e Comandas com valores discriminados.
     - Aba 3: Métricas de LTV, Ticket Médio e Frequência média de visitas.
   - Ações rápidas de cabeçalho: Enviar WhatsApp, Nova Comanda e Novo Agendamento.

3. **Modais de Ação Rápida**:
   - O componente `Modal` com efeito double-bezel é mantido para fluxos de criação e edição rápida de registros cadastrais.

## Consequências
- Visual limpo, técnico e profissional sem distrações.
- Manutenção do contexto operacional do gerente sem troca brusca de página.
