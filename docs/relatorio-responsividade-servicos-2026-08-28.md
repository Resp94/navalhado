# Relatório de Responsividade — Cards de Serviços

**Data:** 28/08/2026  
**Stack:** React · TypeScript · Vite · CSS responsivo  
**Tipo de página:** Grid de cards  
**Arquivos:**

- `src/pages/gerente/Servicos.tsx`
- `src/pages/gerente/__tests__/Servicos.test.tsx`

## Resumo Executivo

Os cards de serviços estavam altos no viewport mobile de 390×844 e o nome do primeiro serviço era quebrado por causa dos badges de posição e categoria. A solução mantém as informações completas no desktop e trata esses dois elementos como secundários somente no mobile.

**Veredicto:** Responsivo ✅

## 🔴 Bloqueantes Corrigidos (1 item)

| # | Problema | Arquivo | Linha | Correção |
|---|---|---|---:|---|
| 1 | Cards altos e nome do serviço truncado em 390px | `src/pages/gerente/Servicos.tsx` | 1541 | Ocultação mobile dos badges redundantes e reorganização da linha do nome em uma única coluna. |

## 🟡 Warnings Corrigidos (1 item)

| # | Problema | Arquivo | Linha | Correção |
|---|---|---|---:|---|
| 1 | Espaçamento vertical excessivo no contêiner da lista mobile | `src/pages/gerente/Servicos.tsx` | 1501 | Padding do contêiner reduzido apenas no breakpoint mobile. |

## ⚠️ Atenção Manual (1 item)

- Confirmar em dispositivos reais se nomes excepcionalmente longos continuam legíveis nas larguras de 320px e 375px.

## 📊 Score do escopo auditado

- **Antes:** 3/5 critérios específicos atendidos
- **Depois:** 5/5 critérios específicos atendidos

## Evidências

- Viewport mobile: **390×844**.
- Altura aproximada do card: **162px → 92px**.
- `Corte Degrade Premium` exibido sem truncamento horizontal.
- Scroll horizontal: não identificado (`scrollWidth` inferior à largura da viewport).
- Viewport desktop: **1280×900**.
- Badges de posição e categoria continuam visíveis no desktop.

## 🧪 Checklist de Teste Manual

### Mobile

1. [ ] **320px portrait** — Sem scroll horizontal
2. [ ] **375px portrait** — Layout legível
3. [x] **390px portrait** — Cards compactos e nome legível
4. [ ] **390px landscape** — Layout adaptado

### Tablet

5. [ ] **768px portrait** — Layout intermediário
6. [ ] **820px portrait** — Cards e espaçamento
7. [ ] **1024px landscape** — Touch targets

### Desktop

8. [x] **1280px** — Cards preservados
9. [ ] **1920px** — Conteúdo contido
10. [ ] **2560px** — Conteúdo contido

### Cross-cutting

11. [ ] **Zoom 200%** — Conteúdo legível
12. [ ] **Navegação por Tab** — Foco visível
13. [ ] **Touch targets** — Botões adequados
14. [ ] **PageSpeed Mobile** — Métricas de performance

## Verificações automatizadas

- `npm test -- --run src/pages/gerente/__tests__/Servicos.test.tsx` — **4 testes aprovados**.
- Validação visual manual em 390×844 e 1280×900 — **aprovada**.
