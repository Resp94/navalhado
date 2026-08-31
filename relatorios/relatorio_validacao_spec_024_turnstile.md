# Relatório de validação — Spec 024: Turnstile

**Data:** 30/08/2026  
**Ambiente:** produção  
**Resultado:** ✅ Confirmado manualmente pelo responsável do projeto

## Resultado

O responsável pelo projeto confirmou que o Cloudflare Turnstile está funcionando em produção após a configuração da site key no ambiente correspondente.

O widget está no modo `Managed`, portanto a ausência de um desafio visual para todos os visitantes é esperada. A confirmação funcional foi feita no próprio ambiente de produção.

## Limites da evidência

- A confirmação de produção é manual e foi fornecida pelo responsável do projeto.
- A validação realizada anteriormente no navegador interno não conseguiu carregar a API externa do Cloudflare; por isso, aquela rodada não foi usada como prova do funcionamento real.
- Os testes unitários existentes usam uma API simulada e comprovam somente o contrato do componente.

## Regras verificadas

- A sessão pública continua anônima no Supabase.
- O Turnstile protege a entrada de gerenciamento da sessão.
- A site key não deve ser tratada como segredo no frontend; a secret key permanece somente no backend/configuração protegida.
- Nenhum token de cliente é exposto no link público.

## Segurança

Não foram registrados neste relatório valores de site key, secret key, tokens de desafio, telefones ou identificadores pessoais.

## Referências

- [Spec 024](../specs/024-portal-publico-sessao/spec.md)
- [Snapshot de produção](../snapshot/2026-08-30-spec-024-turnstile-producao-confirmado.md)
