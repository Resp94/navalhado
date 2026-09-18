# 13: Autenticação e Onboarding

**What to build:** as telas de autenticação e onboarding (`Login`, `ResetPassword`, `CadastroBarbearia`, `OnboardingWizard`, `AcessoExpirado`) passam a usar utilitários Tailwind, preservando validação de formulário e mensagens de erro.

**Blocked by:** 01 (Fundação Tailwind), 02 (Remoção do modo escuro), 03 (Componentes UI compartilhados)

**Status:** done

- [x] Bloco `<style>` inline de cada tela listada removido e convertido
- [x] Login, reset de senha, cadastro de barbearia e wizard de onboarding verificados manualmente sem mudança de comportamento
- [x] Mensagens de erro e estados de validação de formulário preservados
- [x] Testes existentes dessas telas continuam passando, com seletores por classe CSS removida reescritos
- [x] `npm run test`, `npm run build` e `oxlint` continuam passando
