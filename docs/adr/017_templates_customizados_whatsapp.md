# ADR 017: Personalização de Templates de Notificação WhatsApp com Fallback Seguro

## Status

Aceita em 2026-08-17. Complementa a ADR 010 e é complementada pela especificação 022 para a política de `{link}` e primeiro contato.

## Contexto

As barbearias do Navalhado necessitam de flexibilidade para personalizar o tom de voz e o formato das mensagens automáticas e manuais enviadas pelo WhatsApp (confirmação de agendamento, reagendamento, cancelamento, lembrete prévio e boas-vindas/primeiro contato com link de autoatendimento). Anteriormente, os textos dessas mensagens eram estáticos (*hardcoded*) na Edge Function e no frontend.

## Decisões

1. **Modelagem de Dados Granular no PostgreSQL (`public.whatsapp_instances`)**:
   - Foram adicionadas 5 colunas dedicadas de texto na tabela `public.whatsapp_instances`:
     - `template_confirmation TEXT`: Mensagem de confirmação de novo agendamento.
     - `template_reschedule TEXT`: Mensagem de confirmação de reagendamento.
     - `template_cancellation TEXT`: Mensagem de cancelamento de agendamento.
     - `template_reminder TEXT`: Mensagem de lembrete com antecedência configurável.
     - `template_first_contact TEXT`: Mensagem de boas-vindas / resposta ao primeiro contato recebido com o link de agendamento.
   - Adicionadas restrições `CHECK (length(...) <= 2000)` para cada coluna, garantindo integridade e prevenindo payloads abusivos.
   - Permissões de coluna (`GRANT SELECT` e `GRANT UPDATE`) concedidas à role `authenticated` sob as políticas de RLS já ativas para o Gerente do tenant.

2. **Interpolação de Tags Dinâmicas e Fallback Não-Quebrante (*Non-Breaking*)**:
   - As mensagens suportam as seguintes variáveis declarativas entre chaves:
     - `{cliente}`: Nome do cliente.
     - `{barbearia}`: Nome da barbearia / tenant.
     - `{servico}`: Nome do serviço agendado.
     - `{profissional}`: Nome do barbeiro / profissional responsável.
     - `{data}`: Data formatada no fuso horário do tenant (ex: `18/08/2026`).
     - `{horario}`: Horário formatado (ex: `14:30`).
     - `{link}`: URL tokenizada de acesso direto ao Canal do Cliente.
   - **Garantia de Não-Regressão**: Se qualquer coluna no banco for `null`, vazia ou não personalizada, o sistema recorre imediatamente à constante `DEFAULT_TEMPLATES`, mantendo 100% de paridade com o comportamento de fábrica original.

3. **Link de Autoatendimento Opcional e Política de Primeiro Contato**:
   - A tag `{link}` é opcional em modelos personalizados. Quando presente, recebe a URL tokenizada do Canal do Cliente; quando ausente, nenhum link é anexado automaticamente ao texto personalizado.
   - O modelo padrão continua contendo `{link}` quando essa é a experiência padrão do evento. Um modelo personalizado vazio continua usando o fallback padrão.
   - A primeira mensagem do dia para o cliente pode ser respondida mesmo sem palavra-chave. Depois dela, a resposta automática depende exclusivamente das palavras-chave configuradas pelo tenant; lista vazia não restaura palavras-chave padrão.
   - A interface informa essa política e mantém o botão de salvar disponível quando o modelo personalizado não contém `{link}`.

4. **Experiência do Usuário (Frontend - Split View & Teste Real)**:
   - A página `/whatsapp` recebe uma seção dedicada com abas para cada um dos 5 tipos de evento.
   - A interface opera em *Split View*: editor à esquerda com chips de inserção rápida de tags, contador de caracteres e botão "Restaurar Padrão"; à direita, um balão interativo simulando o visual nativo do WhatsApp com renderização em tempo real.
   - O salvamento é explícito através do botão "Salvar Modelo", com feedback visual e toast de confirmação.
   - Disponibilizado atalho direto "Enviar Teste deste Modelo para meu WhatsApp" para disparo instantâneo no número do gerente via Edge Function `/send-manual`.

## Consequências

- O gestor ganha autonomia completa para ajustar a comunicação da barbearia.
- A segurança e a resiliência do sistema de disparos permanecem preservadas através de fallbacks estritos.
- Nenhuma alteração afeta negativamente instâncias existentes sem personalização.
