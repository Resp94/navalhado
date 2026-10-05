# 14: Publicar os textos novos, com aviso de 15 dias

Parte da spec 055 (Conformidade com os novos Termos e Política).

**What to build:** as minutas revisadas pelo advogado (`docs/legal/termos-de-uso.md` e `politica-de-privacidade.md`, sem nenhum `[A DEFINIR]`) entram em `src/modules/termos/textos.ts`, e `VERSAO_ATUAL_DOS_TERMOS` vira a data de vigência.

Os Gerentes ativos recebem um e-mail 15 dias antes da vigência, enviado pelo mesmo caminho dos avisos de cobrança (Resend), com o resumo do que mudou e os links de `/termos` e `/privacidade`. Na data de vigência, o front com a versão nova vai ao ar e cada Gerente aceita na entrada, como já funciona.

O banco recusa versão futura, então o front com a versão nova não pode subir antes da data.

**Blocked by:**

- revisão do advogado;
- os tickets 01, 02, 03, 04, 05 e 07;
- o 09, se a cláusula do arrependimento ficar;
- os e-mails suporte@ e privacidade@navalhado.com.br funcionando;
- os dados do titular do MEI preenchidos

**Status:** blocked

- [ ] As minutas sem `[A DEFINIR]` e com o texto final do advogado
- [ ] `textos.ts` com as seções novas. Os testes de `textos.test.ts` seguem: sem preço em reais; a versão é uma data
- [ ] O hash da versão nova registrado no teste do ticket 08
- [ ] O e-mail de aviso: modelo em React Email; envio único para os Gerentes ativos, com o OK do usuário antes de disparar (no DEV, só para e-mails de teste)
- [ ] O deploy do front na data de vigência é combinado com o usuário (cada push na dev dispara deploy)
- [ ] Gates de lint, Vitest e build passam
