# Especificação de Produto (PRD): Personalização de Templates de WhatsApp

## Problem Statement

Atualmente, o gestor da barbearia no Navalhado não possui autonomia para personalizar o tom de voz e o formato das mensagens disparadas via WhatsApp aos seus clientes. Todas as mensagens (confirmação de agendamento, reagendamento, cancelamento, lembrete de horário e link de autoatendimento para novos contatos) possuem textos fixos e estáticos embutidos no código. Isso impede que barbearias com identidades distintas (formais, descontraídas, premium ou tradicionais) comuniquem-se de maneira alinhada à sua marca, além de impossibilitar a adição de recados contextuais (ex: instruções de estacionamento, tolerância de atraso ou formas de pagamento).

## Solution

Criar uma infraestrutura completa e flexível de gerenciamento de **Templates de Notificação WhatsApp** no painel do Gerente (`/whatsapp`), permitindo a customização do texto para os 5 eventos canônicos do sistema com suporte a interpolação de tags dinâmicas (`{cliente}`, `{barbearia}`, `{servico}`, `{profissional}`, `{data}`, `{horario}`, `{link}`). 

A solução garante retrocompatibilidade e resiliência total através de **fallback automático** para textos padrão em caso de campos não preenchidos, **validação visual da tag `{link}`** para deixar explícito quando o modelo personalizado não incluirá o link, um **editor em Split View com Live Preview no formato de balão nativo do WhatsApp**, e um mecanismo de **disparo de teste instantâneo no número real do gerente**.

---

## User Stories

1. Como **Gerente da barbearia**, quero acessar uma seção dedicada de personalização de mensagens na página de WhatsApp, para configurar o texto de cada tipo de comunicação enviada aos meus clientes.
2. Como **Gerente da barbearia**, quero alternar entre abas claras para cada um dos 5 eventos canônicos (Confirmação, Reagendamento, Cancelamento, Lembrete e Primeiro Contato), para editar o modelo específico sem confusão.
3. Como **Gerente da barbearia**, quero visualizar chips clicáveis com as variáveis dinâmicas disponíveis (`{cliente}`, `{data}`, `{horario}`, `{link}`, etc.), para inseri-las na posição do cursor sem precisar memorizar os nomes técnicos das tags.
4. Como **Gerente da barbearia**, quero ver um simulador de WhatsApp em tempo real ao lado do editor, para visualizar exatamente como o cliente receberá a mensagem no celular antes de salvar.
5. Como **Gerente da barbearia**, quero receber um alerta visual destacado caso eu remova a tag `{link}` do texto, para entender que o modelo personalizado não incluirá a URL automaticamente.
6. Como **Gerente da barbearia**, quero poder salvar um modelo sem a tag `{link}`, para enviar uma mensagem personalizada sem link quando essa for a comunicação desejada.
7. Como **Gerente da barbearia**, quero contar com um botão "Restaurar Padrão" em cada aba, para resetar o texto original de fábrica com um clique caso eu queira desfazer minhas alterações.
8. Como **Gerente da barbearia**, quero um botão explícito de "Salvar Modelo" com feedback visual de carregamento e confirmação por Toast, para ter certeza de que minhas mensagens foram persistidas com sucesso.
9. Como **Gerente da barbearia**, quero um atalho "Enviar Teste deste Modelo para meu WhatsApp", para receber o modelo ativo preenchido com dados de exemplo no meu próprio aparelho e testar a leitura real.
10. Como **Cliente da barbearia**, quero receber mensagens com o tom de voz personalizado e acolhedor da minha barbearia ao agendar, reagendar ou receber lembretes, com links funcionais para gerenciar meu horário.
11. Como **Sistema (Backend/Edge Function)**, quero recorrer automaticamente ao texto canônico de fábrica se um template estiver nulo ou vazio no banco de dados, para garantir que nenhuma notificação falhe por ausência de customização.

---

## Implementation Decisions

### 1. Modelagem e Persistência no PostgreSQL
- **Armazenamento:** Criação de 5 colunas dedicadas do tipo `TEXT` na tabela canônica `public.whatsapp_instances`:
  - `template_confirmation`: Confirmação de novo agendamento.
  - `template_reschedule`: Confirmação de reagendamento.
  - `template_cancellation`: Notificação de cancelamento.
  - `template_reminder`: Lembrete pré-atendimento (vinculado à antecedência de `reminder_hours`).
  - `template_first_contact`: Resposta ao primeiro contato recebido no WhatsApp bot.
- **Validação de Tamanho (Check Constraints):** Cada coluna possui uma restrição `CHECK (length(...) <= 2000)` para prevenir payloads excessivos e preservar a cota de caracteres do provedor de mensageria.
- **Segurança e RLS (Least Privilege):** 
  - Concessão de permissões granulares de coluna (`GRANT SELECT` e `GRANT UPDATE`) para o papel `authenticated`.
  - As políticas RLS existentes asseguram que apenas o Gerente do respectivo tenant consiga visualizar e editar seus próprios templates.

### 2. Contrato de Interpolação e Fallback na Mensageria
- **Tags Suportadas:**
  - `{cliente}`: Nome de exibição do cliente.
  - `{barbearia}`: Nome do estabelecimento/tenant.
  - `{servico}`: Nome do procedimento/serviço agendado.
  - `{profissional}`: Nome do barbeiro executor.
  - `{data}`: Data formatada de acordo com o timezone do tenant (ex: `18/08/2026`).
  - `{horario}`: Horário formatado no fuso horário do tenant (ex: `14:30`).
  - `{link}`: URL tokenizada de autoatendimento no Canal do Cliente.
- **Mecanismo de Não-Regressão (*Non-Breaking Fallback*):**
  - Existência de um dicionário estático imutável de textos canônicos (`DEFAULT_TEMPLATES`).
  - O formatador de mensagens avalia: `template_customizado?.trim() || DEFAULT_TEMPLATE`, garantindo paridade total de funcionamento para instâncias existentes.
- **Link opcional:**
  - A interface informa quando `/\{link\}/i` não está presente, mas não bloqueia a gravação. O backend não anexa o link automaticamente ao modelo personalizado.
- **Primeiro contato:**
  - A primeira mensagem do dia é respondida mesmo sem palavra-chave. Nas mensagens seguintes, o matching usa exclusivamente as palavras-chave configuradas pelo tenant; lista nula ou vazia não recupera valores padrão.

### 3. Interface do Usuário e Design System
- **Layout Split View:**
  - Coluna Esquerda: Seletor de abas horizontais com ícones Hugeicons oficiais, textarea com contador de caracteres (máx. 2.000), barra de chips/pills de inserção de tags, banner de alerta condicional e botões de ação ("Restaurar Padrão" e "Salvar Modelo").
  - Coluna Direita: Simulador de smartphone com balão nativo do WhatsApp (verde clássico com horário em tempo real e duplo check azul), renderizando os dados de exemplo (`SAMPLE_MOCK_VARIABLES`) dinamicamente.
- **Integração de Teste Real:**
  - Botão no simulador que aciona a rota `/send-manual` da integração de WhatsApp, transmitindo o texto renderizado do template ativo para o número informado.
- **Fidelidade ao Design System:**
  - Adoção estrita dos tokens de cores do Navalhado (`--color-brand-primary`, `--color-bg-secondary`, `--color-border`, `--color-text-primary`, `--color-warning-bg`, etc.), tipografia *Outfit* e animações de transição GSAP entre as abas.

---

## Testing Decisions

- **Critério de Teste de Qualidade:** Os testes devem validar comportamentos externos observáveis (interpolação correta de tags, persistência de dados, renderização do preview, ativação de alertas e bloqueio de botões), sem acoplamento a detalhes efêmeros de implementação interna.
- **Módulos Testados:**
  1. `src/modules/whatsapp/templates.ts`: Testes unitários puros cobrindo interpolação de todas as variáveis, substituição de dados simulados, aviso sobre a tag opcional `{link}` e integridade das constantes de fallback.
  2. `src/pages/gerente/Whatsapp.tsx`: Testes de componentes React (Vitest + Testing Library) validando:
     - Renderização das abas e troca de contexto.
     - Inserção de tags ao clicar nos chips.
     - Exibição de alerta e possibilidade de salvar quando `{link}` for removido.
     - Disparo correto do salvamento no Supabase com os valores atualizados.
     - Restauração para o texto padrão ao clicar em "Restaurar Padrão".
  3. `supabase/functions/whatsapp-integration`: Testes de unidade cobrindo a formatação e fallback das mensagens nos endpoints de notificação, lembretes e webhook de entrada.

---

## Out of Scope

- Criação de novos eventos de disparo além dos 5 já existentes no sistema (Confirmação, Reagendamento, Cancelamento, Lembrete e Primeiro Contato).
- Envio de mídias pesadas (áudios, PDFs, vídeos ou figurinhas) nos templates automatizados.
- Configuração de templates diferenciados por profissional individual (os templates são configurados no nível do tenant/barbearia).
- Criação de tabelas de histórico ou versionamento complexo de mensagens antigas no banco de dados.

---

## Further Notes

- A migração SQL foi versionada como `20260817181000_023_whatsapp_custom_templates.sql` e aplicada com sucesso no banco de dados de desenvolvimento.
- As decisões técnicas e de domínio encontram-se documentadas no [CONTEXT.md](file:///c:/Projetos/navalhado/CONTEXT.md) e na [ADR 017](file:///c:/Projetos/navalhado/docs/adr/017_templates_customizados_whatsapp.md).
