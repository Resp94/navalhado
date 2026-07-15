# ADR 002: Cliente provisório no primeiro contato pelo WhatsApp

## Status

Aceito

## Data

2026-07-15

## Contexto

O link de agendamento atual depende de um `customer` e de seu `token_acesso`. Mensagens de números ainda não cadastrados chegam ao webhook, porém não podem receber um link válido. Coletar o nome pelo chat exigiria estado conversacional; usar um link público permitiria informar telefones de terceiros.

## Decisão

Criar ou reutilizar atomicamente um cliente provisório no primeiro contato, isolado por barbearia e telefone normalizado. O bot envia apenas o link tokenizado. A página de agendamento coleta o nome quando o cadastro estiver incompleto e, após salvá-lo, ativa permanentemente o cadastro.

## Alternativas consideradas

1. **Cliente provisório** — escolhida por reutilizar o modelo tokenizado e exigir mudanças localizadas.
2. **Convite temporário separado** — mantém a tabela de clientes mais pura, mas adiciona entidade, expiração e fluxo maiores.
3. **Link público com telefone digitado** — simples, porém não vincula de forma confiável o remetente ao telefone informado.

## Consequências

- Novos números recebem o link imediatamente.
- O nome é solicitado somente no primeiro acesso.
- O banco passa a distinguir cadastro provisório de completo.
- Normalização e unicidade por tenant tornam-se invariantes do domínio.
- Cadastros provisórios abandonados podem permanecer no banco.
- O token continua funcionando como credencial bearer.

