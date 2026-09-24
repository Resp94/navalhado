# 03: Push da `main` e logo em produção

**What to build:** a `main` publicada e a logo do e-mail servida por `app.navalhado.com.br`, antes de qualquer hook ser ligado em prod.

**Blocked by:** 02

**Status:** needs-human (confirmação do push no momento)

- [x] Push da `main` feito só com confirmação do usuário no momento
- [x] `https://app.navalhado.com.br/email/logo.png` responde `200 image/png`
- [x] O app de prod continua abrindo, sem erro de console novo
- [x] Horário do push e commit levado à `main` registrados na spec 050

## Resultado (2026-09-24)

Push confirmado pelo usuário. `origin/main` de `78af32e` para `60bd761` (`78af32e..60bd761 main -> main`), às 2026-09-24 ~13:23 UTC.

Logo em `https://app.navalhado.com.br/email/logo.png`: `text/html` (SPA) nas duas primeiras checagens, `200 image/png` na terceira — bundle novo no ar em menos de 45 s. `app.navalhado.com.br` abre normal (Login), sem erro no console.

**`send-auth-email` continua sem publicar em prod** — isso é o ticket 04, não este. Segue para o ticket 04.
