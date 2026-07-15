# ADR 004: Fuso Horário e Ajustes Gerais da Barbearia

## Status

Aceito

## Data

2026-07-15

## Contexto

No Brasil, existem quatro fusos horários oficiais distintos: Horário de Brasília (UTC-3), Horário da Amazônia/Manaus (UTC-4), Horário do Acre (UTC-5), e Fernando de Noronha (UTC-2). 

Até o momento, a aplicação assumia implicitamente o fuso horário de Brasília (`America/Sao_Paulo`) para formatar mensagens automáticas de WhatsApp e avaliar agendamentos. Isso causava inconsistências graves para barbearias localizadas em outros estados (como Amazonas ou Acre), onde clientes visualizavam horários passados como disponíveis para reagendamento/cancelamento, e recebiam mensagens com horários incorretos de acordo com seu horário local.

## Decisão

Adotar uma arquitetura **multi-timezone** nativa em todo o fluxo da plataforma:

1. **Persistência de Fuso Horário por Estabelecimento**: Adicionar a coluna `timezone` na tabela `public.tenants` para registrar o fuso oficial de cada barbearia.
2. **Nova Tela de Ajustes Gerais**: Desenvolver a página `/configuracoes` no painel administrativo do gerente para gerenciar os dados cadastrais da barbearia (Nome, E-mail, Telefone, Endereço) e selecionar o fuso horário oficial (dropdown contendo os principais fusos do Brasil).
3. **Controle de Compromissos Passados**: Ocultar dinamicamente os botões de **Reagendar** e **Cancelar** em `MenuCliente.tsx` caso a data/hora do agendamento esteja no passado com relação à hora atual calculada no fuso horário (`timezone`) da barbearia.
4. **Formatação Dinâmica de WhatsApp**: Adaptar a função `formatDateTime` na Edge Function `whatsapp-integration` para aceitar o `timeZone` do tenant como parâmetro nas rotas `/send-notification` e `/process-reminders`, garantindo que os clientes recebam lembretes com a hora exata local.

## Alternativas consideradas

1. **Uso do Fuso Horário do Navegador**: Basear toda a regra no fuso horário local do navegador do cliente. Rejeitado porque as notificações automatizadas de lembrete (pg_cron e Edge Functions) rodam no lado do servidor (onde o fuso padrão é UTC) e precisam de uma fonte da verdade cadastrada para formatar o horário local correto nas mensagens enviadas.

## Consequências

- A plataforma suporta barbearias localizadas em qualquer fuso horário brasileiro de forma isolada e nativa.
- Clientes finais de barbearias fora do fuso de Brasília não visualizam inconsistências de horário ou opções inválidas de reagendamento/cancelamento de horários já decorridos.
- As mensagens enviadas via integração de WhatsApp refletem com 100% de exatidão a hora combinada localmente.
