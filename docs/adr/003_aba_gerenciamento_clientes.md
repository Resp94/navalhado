# ADR 003: Aba de Gerenciamento de Clientes no Painel do Gerente

## Status

Aceito

## Data

2026-07-15

## Contexto

Até o momento, a aplicação possui um banco de dados estruturado para diferenciar clientes cadastrados de provisórios (vindos do WhatsApp sem nome registrado, com a flag `cadastro_completo = false`). No entanto, não há na interface do gerente uma tela centralizada que permita à barbearia visualizar esses contatos, gerenciar dados cadastrais, realizar cadastros manuais, visualizar o histórico de agendamentos ou obter os links de acesso tokenizados para envio manual.

## Decisão

Adicionar uma nova aba de "Clientes" (`/clientes`) no painel administrativo do gerente, contendo:
1. **Filtros por Origem/Estado**: Visualização separada de clientes Cadastrados vs. Provisórios do WhatsApp.
2. **Promoção Automática**: Caso o gerente edite um cliente provisório e adicione seu nome real, o sistema marcará automaticamente `cadastro_completo = true`, permitindo que o cliente pule o onboarding de nome em seu próximo acesso.
3. **Exclusão com Restrição Física**: A deleção física de clientes com agendamentos vinculados será bloqueada pelo banco de dados (`ON DELETE RESTRICT` na tabela `appointments`). O frontend capturará essa violação de restrição e exibirá um Toast de erro amigável, permitindo excluir normalmente clientes provisórios sem histórico.
4. **Gaveta de Detalhes (Slide-over)**: Apresentação do histórico completo de agendamentos (utilizando consulta JOIN otimizada no Supabase) e atalho rápido para cópia ou envio do link de agendamento tokenizado via WhatsApp Web.

## Alternativas consideradas

1. **Exclusão Lógica (Soft Delete)**: Adicionar uma coluna `deleted_at` à tabela `customers`. Rejeitado por requerer alteração no DDL do banco e complexidade em reescrever todas as políticas RLS existentes para filtrar registros deletados.
2. **Exclusão Física com Alerta (Escolhido)**: Mantém o banco intacto, protege os dados financeiros e permite limpar cadastros provisórios que nunca agendaram.

## Consequências

- O gerente ganha total visibilidade de sua base de clientes e leads vindos do WhatsApp.
- O histórico de transações financeiras e de serviços dos barbeiros é 100% preservado no banco.
- O fluxo de envio do link do cliente por WhatsApp é simplificado através de redirecionamento externo.
- As consultas ao Supabase usam índices nativos para manter a performance estável.
