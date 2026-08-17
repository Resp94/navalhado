# 🍊 Design System Navalhado - Paleta Terrosa Premium

Este documento especifica a identidade visual, escala de cores, tipografia e padrões de interface para o projeto **Navalhado** (SaaS de barbearias), utilizando a paleta sofisticada de tons terrosos, âmbar e laranjas quentes para transmitir uma estética clássica de luxo e alta barbearia.

---

## 🎨 Paleta de Cores (Design Tokens)

As cores são divididas em variáveis de marca (extraídas da paleta oficial), neutras quentes (para os temas claro e escuro) e semânticas. Elas devem ser declaradas como variáveis CSS globais no arquivo `src/index.css`.

### 1. Cores de Marca (Amber & Orange Core)
Utilizadas para elementos de destaque, botões de ação principal (CTAs), links ativos e identidade visual terrosa.

| Token | Valor Hex | Nome Original | Aplicação |
| :--- | :--- | :--- | :--- |
| `--color-brand-primary` | `#D96C00` | Mandarin Glow | Cor de ação principal (CTAs), ícones ativos, elementos de destaque. |
| `--color-brand-hover` | `#9C3F00` | Burnt Orange | Estado de hover/foco em botões e elementos interativos. |
| `--color-brand-deep` | `#6A2E00` | Deep Amber | Detalhes de borda premium, títulos de destaque ou acentos profundos. |
| `--color-brand-soft` | `#F2B277` | Soft Apricot | Badges secundárias, bordas interativas leves ou texto de destaque suave. |
| `--color-brand-lightest`| `#FFF1E6` | Peach Veil | Fundo claro sutil, cor de fundo de alertas quentes ou texto alternativo. |

### 2. Cores Neutras Quentes (Tema Claro - Padrão do Sistema)
O tema padrão do Navalhado (fluxo do cliente e visual inicial) é claro, utilizando uma escala de off-whites quentes e cinzas terrosos.

| Token | Valor Hex | Nome Comercial | Aplicação |
| :--- | :--- | :--- | :--- |
| `--color-bg-primary` | `#FFF1E6` | Peach Veil | Fundo principal da aplicação em tema claro (Viewport). |
| `--color-bg-secondary` | `#FFFFFF` | Branco Puro | Fundo de cards, painéis e modais em tema claro. |
| `--color-border` | `#EADED6` | Areia | Divisores, contornos e bordas de inputs. |
| `--color-text-primary` | `#2D231E` | Terra Escura | Títulos e textos principais de leitura (máximo conforto). |
| `--color-text-secondary` | `#70625B` | Argila | Textos de apoio, labels de inputs e placeholders. |

### 3. Cores Neutras Quentes (Tema Escuro - Alternativo/Suportado)
O sistema terá suporte completo ao modo escuro (Dark Mode), utilizando uma escala de pretos e cinzas baseada em tons quentes (café/carvão terroso) em harmonia com os laranjas.

| Token | Valor Hex | Nome Comercial | Aplicação |
| :--- | :--- | :--- | :--- |
| `--color-bg-primary` | `#14110F` | Preto Café | Fundo principal da aplicação em tema escuro (Viewport). |
| `--color-bg-secondary` | `#1E1B18` | Carvão Quente | Fundo de cards, painéis, tabelas e modais. |
| `--color-border` | `#332D29` | Bronze Escuro | Divisores, contornos de inputs e separadores de seção. |
| `--color-text-primary` | `#FFF1E6` | Peach Veil (Off-White) | Texto principal de leitura e títulos em tema escuro. |
| `--color-text-secondary` | `#9C958F` | Cinza Fumo | Textos de apoio, labels e placeholders. |

### 4. Cores Semânticas (Status)
Cores para feedbacks visuais, mantendo o nível de contraste e acessibilidade exigido.

| Token | Valor Hex | Cor Suave (BG) | Nome | Aplicação |
| :--- | :--- | :--- | :--- | :--- |
| `--color-success` | `#0E9F6E` | `#E6F4EA` | Verde Sucesso | Agendamento confirmado, pagamento concluído, ativo. |
| `--color-error` | `#F05252` | `#FDE8E8` | Vermelho Alerta | Agendamento cancelado, atrasado, erro, excluir. |
| `--color-warning` | `#D97706` | `#FEF3C7` | Ouro Quente | Aguardando profissional, pendente. |
| `--color-info` | `#3F83F8` | `#EBF5FF` | Azul Cobalto | Informativo, badges informativas, links neutros. |

---

## 🔤 Tipografia

*   **Fonte Display e Títulos:** `Outfit`, sans-serif (títulos de páginas, métricas e cabeçalhos).
*   **Fonte Principal de Interface:** `Inter`, sans-serif (corpo de texto, inputs, tabelas e botões).
    *   *Alternativa:* `System UI` (caso a fonte externa não carregue).
*   **Tamanhos de Fonte (Scale):**
    *   `font-size-xs`: `0.75rem` (12px) - Informações de rodapé, micro-textos.
    *   `font-size-sm`: `0.875rem` (14px) - Texto padrão de inputs, labels, tabelas.
    *   `font-size-base`: `1rem` (16px) - Texto corrido principal.
    *   `font-size-lg`: `1.125rem` (18px) - Subtítulos e títulos de cards.
    *   `font-size-xl`: `1.25rem` (20px) - Títulos de seções secundárias.
    *   `font-size-2xl`: `1.5rem` (24px) - Títulos de páginas.
    *   `font-size-3xl`: `1.875rem` (30px) - Destaques numéricos (MRR, Faturamento).

---

## 📐 Espaçamentos e Bordas (Layout Tokens)

*   **Grid de Espaçamentos (Base 4px):**
    *   `space-1`: `4px`
    *   `space-2`: `8px`
    *   `space-3`: `12px`
    *   `space-4`: `16px` (Padrão de padding interno)
    *   `space-6`: `24px` (Padrão de gap de seções)
    *   `space-8`: `32px`
*   **Arredondamento de Bordas (Border Radius):**
    *   `radius-sm`: `4px` - Badges e pequenos elementos.
    *   `radius-md`: `8px` - Inputs, botões e selects.
    *   `radius-lg`: `12px` - Cards, modais e containers principais.
    *   `radius-full`: `9999px` - Avatares e badges circulares.

---

## 💎 Efeitos Visuais (Premium Aesthetics)

*   **Sombra de Elevação (Shadows):**
    *   `shadow-sm`: `0 1px 2px 0 rgba(20, 17, 15, 0.05)`
    *   `shadow-md`: `0 4px 6px -1px rgba(20, 17, 15, 0.15), 0 2px 4px -1px rgba(20, 17, 15, 0.1)`
    *   `shadow-lg`: `0 10px 15px -3px rgba(20, 17, 15, 0.3), 0 4px 6px -2px rgba(20, 17, 15, 0.2)`
*   **Micro-Animações (Transitions):**
    *   Todos os elementos interativos (botões, links, inputs) devem possuir `transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1)`.
    *   Efeito de hover em botões principais deve fazer a cor transicionar de `--color-brand-primary` (`#D96C00`) para `--color-brand-hover` (`#9C3F00`) com um leve deslocamento vertical (ex: `transform: translateY(-1px)`).
