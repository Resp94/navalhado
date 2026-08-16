# 05 — Parametrização Comercial de Serviços (Tempo de Retorno, Template WhatsApp e Tipo de Preço)

**What to build:**
Implementar na tela `/servicos` os novos parâmetros comerciais: tempo estimado de retorno em dias, template personalizado de mensagem de retorno para WhatsApp e chaveador entre preço fixo e "A partir de".

**Blocked by:** 01 — Migração de Banco Versionada 018, 04 — Associação Granular de Serviços e Autonomia de Duração do Barbeiro

**Status:** ready-for-agent

- [ ] Atualizar o formulário e modal de cadastro/edição de serviços em `/servicos/cadastro` com os campos `return_period_days`, `custom_reminder_template` e `price_type` (`fixed` vs `starting_at`).
- [ ] Adicionar seletor visual e tags dinâmicas no template de WhatsApp (ex: `{cliente}`, `{servico}`, `{dias}`, `{link}`).
- [ ] Atualizar a renderização dos cards/linhas de serviços no catálogo para exibir a indicação "A partir de" quando aplicável.
- [ ] Garantir que o valor padrão de duração para novos serviços seja 40 minutos.
- [ ] Criar testes unitários para a validação dos novos parâmetros de serviço.
- [ ] Realizar validação visual no navegador em `http://localhost:5173/servicos/cadastro`.
