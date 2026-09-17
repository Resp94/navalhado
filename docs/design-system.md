# Navalhado — Design System

Artefato vivo (referência copy-paste de componentes): https://claude.ai/artifact/6S4aK7CpQsewPJApGyaCt4

Este documento é um índice de apoio. A fonte de verdade visual/interativa é o artefato acima; os tokens reais vivem em [`src/index.css`](../src/index.css).

## Tokens

```css
--color-brand-primary: #D96C00;
--color-brand-primary-solid: #B85900;   /* fill sólido com texto branco (WCAG AA) */
--color-brand-hover: #9C3F00;
--color-brand-deep: #6A2E00;
--color-brand-soft: #F2B277;
--color-brand-lightest: #FFF1E6;

--color-bg-primary: #FFF1E6;
--color-bg-secondary: #FFFFFF;
--color-border: #EADED6;
--color-text-primary: #2D231E;
--color-text-secondary: #70625B;

--color-success: #0E9F6E;      --color-success-solid: #0C8560;      --color-success-bg: #E6F4EA;
--color-error: #F05252;        --color-error-solid: #C23B3B;        --color-error-bg: #FDE8E8;
--color-warning: #D97706;      --color-warning-solid: #A85A04;      --color-warning-bg: #FEF3C7;
--color-info: #3F83F8;         --color-info-solid: #1F5FC7;         --color-info-bg: #EBF5FF;

--font-base: 'Outfit', sans-serif;
--shadow-sm: 0 1px 2px rgba(45, 35, 30, 0.06);
--shadow-md: 0 4px 12px rgba(45, 35, 30, 0.08);
--shadow-lg: 0 8px 30px rgba(217, 108, 0, 0.12);
--radius-sm: 4px; --radius-md: 8px; --radius-lg: 12px; --radius-xl: 16px; --radius-full: 9999px;
```

Os tokens `-solid` (brand/success/warning/error/info) existem porque as versões base falham contraste WCAG AA (3.19–3.61:1) contra texto branco. Use `-solid` sempre que o fill for sólido com texto branco (botão primary, badge solid, status pill preenchido); use a versão base para bordas, ícones e fundos sutis (`-bg`).

## Componentes catalogados no artefato

- Button, IconButton
- Badge (subtle / solid / outline)
- Campos de formulário (Input, Select)
- SearchInput, Textarea & Radio
- Table + Pagination
- Tooltip
- EmptyState
- Skeleton
- Tabs (SegmentedControl)
- Toast
- Avatar group
- PercentageBar
- Breadcrumb
- Stepper
- Command palette
- Context menu
- Dropdown
- Popover
- Drawer
- Modal de confirmação
- Modo Mobile: MobileHeader + MobileBottomNav, MobileBottomSheet
- Motion (timing/easing de referência)
- Elevação (escala de z-index)
- Breakpoints

Cada card de componente no artefato tem um botão "Copiar" que copia o snippet JSX real de uso.

## Regras de uso

- Cor, raio, sombra e fonte sempre via token (`var(--color-*)` / classes Tailwind equivalentes) — nunca hex solto novo numa tela.
- 1 botão **primary** por contexto; o resto usa secondary/outline/ghost.
- Contorno padrão de card/input é `shadow: 0 0 0 0.8px var(--color-text-primary)`, não `border` — mantém 1px nítido em qualquer zoom.
- Mobile: inputs sempre com `font-size: 16px` (evita auto-zoom iOS); toque mínimo de 44px de altura.
- Um componente novo só nasce em `src/components/ui/` depois de checar que já não existe algo parecido lá.
- Estado selecionado/ativo/atual (aba, item de menu, passo, página) sinaliza com cor de marca no **texto, ícone, borda ou badge** — nunca fundo sólido. Fundo sólido (`bg-brand-primary-solid`) é reservado pro botão primary e pra controles do tamanho de um ícone (checkbox, radio, dot do step) — numa superfície grande ele compete com o CTA da tela.

## Débitos conhecidos (fora do escopo desta rodada)

Passagem de contraste WCAG AA aplicada em `Button`, `Badge`, `SegmentedControl` e `ComandaCheckoutModal.tsx`. Ainda existem ~35 ocorrências do padrão `bg-{semantic} text-white` fora desses arquivos (Agenda.tsx, Produtos.tsx, onboarding, financeiro/relatórios, CadastroAcesso.tsx, Whatsapp.tsx, GlassSidebar.tsx etc.) aguardando aprovação explícita pra correção em lote.
