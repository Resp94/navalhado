# 02 — Autenticação Mobile (Login, Teclado Virtual e Bottom Sheet de Recuperação)

**What to build:**
Adaptar as telas de Login, Recuperação de Senha e Cadastro para smartphones (`<= 768px`), garantindo que o card central tenha margens confortáveis de bolso (sem duplo scroll ou overflow horizontal), que a abertura do teclado virtual no celular não quebre o layout ou oculte o botão "Acessar plataforma", e que o acionamento de "Esqueci a senha" abra uma gaveta inferior deslizante (*Bottom Sheet*) com foco imediato no e-mail.

**Blocked by:** 01 — Infraestrutura de Layout Base, Bottom Navigation e Modais Bottom Sheet

**Status:** ready-for-agent

- [ ] Card de Login ajusta seu padding e largura em telas mobile (`<= 768px`) sem estourar as bordas laterais.
- [ ] O formulário de Login se mantém acessível e rolável de forma fluida quando o teclado virtual é aberto no smartphone.
- [ ] O modal "Esqueci a senha" abre como *Bottom Sheet* deslizante a partir da base no mobile, com foco automático no campo de e-mail e botão de envio na zona do polegar.
- [ ] A tela de redefinição de senha (`ResetPassword.tsx`) apresenta indicador de força de senha nítido e botão de confirmação ergonômico no celular.
- [ ] A tela de cadastro de barbearia (`CadastroBarbearia.tsx`) acomoda todos os passos de onboarding com navegação clara no mobile.
