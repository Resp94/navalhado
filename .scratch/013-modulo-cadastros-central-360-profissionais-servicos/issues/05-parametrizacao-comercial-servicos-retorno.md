# 05 — Parametrização Comercial de Serviços (Tempo de Retorno, Template Uazapi e Tipo de Preço)

**What to build:**
Implementar na tela `/servicos` os novos parâmetros comerciais: tempo estimado de retorno em dias, template personalizado de mensagem de retorno para WhatsApp através da instância conectada da Uazapi (sem links externos), suporte a cron de reativação e chaveador entre preço fixo e "A partir de".

**Blocked by:** 01 — Migração de Banco Versionada 018, 04 — Associação Granular de Serviços e Autonomia de Duração do Barbeiro

**Status:** done

- [x] Atualizar o formulário e modal de cadastro/edição de serviços em `/servicos/cadastro` com os campos `return_period_days`, `custom_reminder_template` e `price_type` (`fixed` vs `starting_at`).
- [x] Adicionar seletor visual e tags dinâmicas no template de WhatsApp (ex: `{cliente}`, `{servico}`, `{dias}`, `{link}`).
- [x] Integrar o disparo de lembrete manual da Central 360 à instância Uazapi conectada da barbearia (`whatsapp_instances`), eliminando links externos de navegador.
- [x] Estruturar a lógica do Cron de Lembrete de Retorno no banco (`pg_cron` / RPC de verificação de clientes elegíveis) com controle de idempotência (`whatsapp_message_idempotency`).
- [x] Atualizar a renderização dos cards/linhas de serviços no catálogo para exibir a indicação "A partir de" quando aplicável.
- [x] Garantir que o valor padrão de duração para novos serviços seja 40 minutos.
- [x] Criar testes unitários para a validação dos novos parâmetros de serviço e montagem do template.
- [x] Realizar validação visual no navegador em `http://localhost:5173/servicos/cadastro`.


