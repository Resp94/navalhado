# Snapshot operacional — Spec 024: Turnstile em produção

**Data do registro:** 30/08/2026  (America/Manaus)  
**Ambiente confirmado:** PROD  
**Status:** ✅ Funcionamento confirmado manualmente pelo responsável do projeto

## Evidência registrada

- O responsável pelo projeto confirmou manualmente que o Turnstile está funcionando no ambiente de produção.
- A confirmação foi realizada após a configuração da site key no ambiente de produção.
- O modo configurado no Cloudflare é `Managed`, que pode concluir a verificação sem exibir um desafio interativo para todos os visitantes.

## Escopo confirmado

- A proteção Turnstile está associada à entrada de gerenciamento da sessão pública.
- A sessão pública continua usando autenticação anônima do Supabase.
- O token do Turnstile é enviado somente para a autenticação da sessão e não é exposto na URL pública.
- A URL pública continua baseada no domínio e slug da barbearia.

## Distinção das validações

- Os testes automatizados do componente comprovam a integração do callback e do token usando uma API simulada.
- A validação anterior no navegador interno confirmou o campo e o bloqueio inicial do botão, mas não conseguiu observar o desafio externo do Cloudflare.
- A confirmação deste snapshot é uma validação manual de produção realizada pelo responsável do projeto; ela não substitui os testes automatizados nem a validação DEV do fluxo completo.

## Regras de segurança preservadas

- Não registrar site key secreta, token de desafio, telefone ou dados de sessão em snapshots, relatórios ou prints.
- Não expor token de cliente na URL pública.
- Não aceitar a sessão sensível sem a validação do Turnstile quando a site key estiver configurada.
- Manter a validação de tenant, cliente e sessão no backend.

## Alterações realizadas

- Nenhuma alteração de código ou banco foi realizada para este registro.
- Nenhuma migration foi criada.
- Este snapshot é local e deve ser versionado junto com os demais registros operacionais.
