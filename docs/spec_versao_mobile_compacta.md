# Spec: Versão Mobile Compacta do Navalhado

## Problem Statement

Atualmente, o **Navalhado** possui um layout rico e detalhado projetado prioritariamente para telas amplas de computadores e tablets (tabelas densas, grade temporal multi-colunas de profissionais, relatórios contábeis e DREs analíticos).

No entanto, no dia a dia real da barbearia, gerentes e barbeiros operam frequentemente em pé no salão, ao lado da cadeira ou no balcão de atendimento, utilizando seus próprios smartphones com uma só mão. Acessar a interface desktop no celular gera atrito:
* Dificuldade de rolagem e leitura horizontal em grades de múltiplos barbeiros.
* Distância ergonômica para alcançar menus e botões no topo da tela com o polegar.
* Lentidão para ações rotineiras de alta frequência (receber uma conta, adicionar um produto à comanda, verificar o próximo cliente ou mandar um WhatsApp rápido).
* Modais centralizados que sofrem corte visual quando o teclado virtual é aberto.

---

## Solution

Criar uma camada de apresentação dedicada para **dispositivos móveis (`<= 768px`)**, que entrega uma experiência compacta, ergonômica e focada na velocidade operacional do dia a dia, mantendo **100% inalterada e funcional a interface de Desktop e Tablet (`> 768px`)**.

A solução introduz:
1. **Navegação Ergonômica Inferior (*Bottom Navigation Bar*):** 5 abas fixas para o Gerente (*Agenda*, *Comandas*, *Caixa*, *Clientes*, *Mais*) e 3 abas para o Barbeiro (*Minha Agenda*, *Comissões*, *Perfil*), todas posicionadas na zona natural do polegar (*thumb zone*) com respeito a `safe-area-insets`.
2. **Agenda Vertical com Carrossel de Profissionais:** Seleção rápida de barbeiros em abas horizontais no topo e linha do tempo vertical legível com identificação imediata de horários livres e botões de ação rápida.
3. **Comandas & Checkout em Gaveta Inferior (*Bottom Sheet*):** Lista de contas abertas e finalização de pagamento em poucos toques.
4. **Caixa Operacional do Dia:** Resumo imediato do faturamento de hoje por método (PIX, Cartão, Dinheiro), sangria, suprimento e fechamento, direcionando relatórios contábeis profundos para a versão desktop.
5. **Busca Rápida de Clientes com Atalho WhatsApp:** Localização instantânea de contatos e disparo de mensagens com 1 toque.
6. **Autenticação Mobile-First:** Login, recuperação de senha e cadastro adaptados para o teclado virtual e navegação em uma só mão.

---

## User Stories

1. **Como um gerente**, eu quero que o sistema identifique automaticamente quando estou no celular (`<= 768px`), para que a interface se adapte a um layout de bolso sem afetar quem usa no computador.
2. **Como um gerente**, eu quero ter uma barra inferior fixa (*Bottom Navigation Bar*) com as 5 funções principais da barbearia, para que eu possa alternar de tela com o polegar usando uma só mão.
3. **Como um gerente**, eu quero visualizar a agenda do dia em uma linha do tempo vertical com cartões legíveis, para que eu não precise rolar horizontalmente para ver os horários.
4. **Como um gerente**, eu quero alternar entre os barbeiros da equipe através de chips/abas no topo da agenda mobile, para focar na programação de cada cadeira individualmente ou ver todos de forma consolidada.
5. **Como um gerente**, eu quero tocar em um horário vago na agenda vertical, para abrir instantaneamente o formulário de novo agendamento ou encaixe rápido.
6. **Como um gerente**, eu quero ver todas as comandas atualmente abertas em uma aba dedicada de Comandas, para acompanhar quem está na cadeira e quem está aguardando para pagar.
7. **Como um gerente**, eu quero clicar no botão "Receber" de uma comanda e ver uma gaveta (*Bottom Sheet*) deslizar de baixo para cima, para escolher a forma de pagamento (PIX, Cartão, Dinheiro) e finalizar a conta em poucos segundos.
8. **Como um gerente**, eu quero abrir uma comanda avulsa rapidamente pelo celular, para registrar a venda de produtos (como pomadas ou bebidas) ou serviços de clientes que entraram sem agendamento prévio.
9. **Como um gerente**, eu quero consultar o total faturado no dia de hoje dividido por forma de pagamento no painel de Caixa, para conferir o dinheiro em caixa sem precisar emitir relatórios pesados.
10. **Como um gerente**, eu quero registrar entradas (suprimento) ou saídas rápidas (sangria) de dinheiro pelo celular, para manter o caixa da gaveta conciliado em tempo real.
11. **Como um gerente**, eu quero abrir e fechar o caixa do dia diretamente pelo smartphone, para encerrar o expediente sem precisar ligar o computador.
12. **Como um gerente**, eu quero buscar clientes por nome ou telefone em tempo real na aba Clientes, para consultar o histórico ou contatar o cliente com rapidez.
13. **Como um gerente**, eu quero tocar no ícone do WhatsApp no cartão do cliente, para abrir diretamente o aplicativo oficial do WhatsApp com a conversa iniciada.
14. **Como um gerente**, eu quero acessar a aba "Mais" para copiar rapidamente o link público de agendamento online da barbearia, para colar na bio do Instagram ou enviar em grupos.
15. **Como um gerente**, eu quero consultar o status da conexão do robô de WhatsApp e horários de funcionamento da barbearia na aba "Mais", para monitorar a operação sem complexidade.
16. **Como um barbeiro (colaborador)**, eu quero acessar o sistema no meu celular e ver apenas a minha agenda pessoal e minhas comissões, para não ter acesso a dados financeiros globais do estabelecimento.
17. **Como um barbeiro (colaborador)**, eu quero atualizar o status do meu atendimento (de "Confirmado" para "Em Atendimento" ou "Concluído") com um toque no cartão do cliente, para manter o fluxo do salão sincronizado.
18. **Como um barbeiro (colaborador)**, eu quero ver o total de comissões acumuladas hoje e na semana atual, para acompanhar meus ganhos em tempo real.
19. **Como um usuário**, eu quero preencher meu e-mail e senha na tela de Login no celular sem que o teclado virtual quebre a visualização ou esconda o botão "Acessar plataforma".
20. **Como um usuário**, eu quero clicar em "Esqueci a senha" no celular e ter uma gaveta inferior deslizante para inserir meu e-mail e solicitar a redefinição de forma rápida.

---

## Implementation Decisions

### 1. Arquitetura de Módulos Profundos e Costura de Apresentação (*Seams*)
* **Costura Única de Responsividade:** O ponto de decisão responsiva fica centralizado nos Layouts raiz (`GerenteLayout` e `BarbeiroLayout`) e nos containers das páginas principais (`Agenda`, `Financeiro`, `Clientes`).
* **Reaproveitamento de Estado e Domínio (Zero Duplicação):** A lógica de negócio, adaptadores de repositório (`ClienteRepository`, `CaixaRepository`, `EsperaRepository`, `BloqueioRepository`), cálculo de fusos horários (`America/Sao_Paulo`) e subscrições Realtime do Supabase permanecem em hooks e módulos profundos compartilhados. As visões Desktop e Mobile atuam como adaptadores visuais distintos consumindo o mesmo contrato.

### 2. Design System e Ergonomia Mobile (Impeccable Shape)
* **Zona do Polegar (*Thumb Zone*):** A barra de navegação (`MobileBottomNav`), ações de confirmação de pagamento e botões primários de formulários ficam fixados na região inferior da tela.
* **Componente de Bottom Sheet:** No mobile (`<= 768px`), modais e gavetas utilizam animação deslizante a partir da base com backdrop suave e alça de arrasto (*drag handle*).
* **Safe Area Insets:** Aplicação de `padding-bottom: calc(var(--bottom-nav-height) + env(safe-area-inset-bottom))` para garantir suporte a aparelhos com barra de navegação por gestos (iOS/Android).
* **Touch Targets:** Todos os elementos interativos possuem dimensão mínima de `44px × 44px`.

### 3. Preservação Absoluta do Desktop / Tablet
* Nenhuma funcionalidade, coluna ou relatório existente na visualização `>= 769px` será removida ou alterada em sua estrutura de apresentação desktop.

---

## Testing Decisions

### 1. O que constitui um bom teste
* Testar o comportamento observável pelo usuário e os contratos de interface, e não detalhes efêmeros de implementação interna.
* Garantir que o cálculo de faturamento, mutações de agendamento e transições de comandas continuem operando de forma idêntica independentemente da largura da tela.

### 2. Validação Visual em Tempo Real (`http://localhost:5173`)
* **Inspeção Visual Contínua (Mobile Emulation):** Durante a execução do plano, cada tela desenvolvida será validada na porta 5173 (servidor ativo) com emulação `390px × 844px`, auditando safe areas, foco do teclado virtual, contraste e ausência de erros no console.
* **Não-Regressão Desktop (`1440px × 900px`):** Validação visual paralela na porta 5173 para confirmar a integridade de todas as telas no modo desktop.

### 3. Módulos Testados
* **Layouts e Navegação:** Renderização condicional da Navbar vs Bottom Bar conforme o breakpoint.
* **Agenda Mobile:** Seleção de data, filtragem por profissional e disparo de modal de novo agendamento.
* **Comandas & Caixa Mobile:** Registro de checkout, cálculo de recebimentos por método de pagamento e ações de sangria/suprimento.
* **Clientes & WhatsApp:** Busca de contatos e geração correta de URLs de disparo WhatsApp.

### 4. Arte Prévia no Repositório
* `src/components/__tests__/GerenteLayout.test.tsx`
* `src/pages/__tests__/Agenda.test.tsx`
* `src/pages/gerente/__tests__/Financeiro.test.tsx`
* `src/pages/gerente/__tests__/Clientes.test.tsx`

---

## Out of Scope

* Recriação de relatórios analíticos de longo prazo (DRE, gráficos de 90 dias, matriz de retenção) em formato mobile.
* Exportação em lote de planilhas CSV pelo smartphone (permanece restrito ao desktop).
* Alterações no banco de dados ou criação de novas tabelas/migrações (o schema atual de banco atende 100% da demanda).

---

## Further Notes

* **Performance:** Utilizar classes utilitárias CSS e aceleração de hardware (`transform: translate3d`) para garantir 60fps em animações de Bottom Sheet mesmo em aparelhos intermediários.
* **Feedback Tátil/Visual:** Efeitos sutis de clique (`active:scale-95`) nos botões e chips de seleção para simular sensação de aplicativo nativo.
