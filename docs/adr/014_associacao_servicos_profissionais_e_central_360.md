# ADR 014: Associação Granular de Profissionais e Serviços e Central 360 de Clientes

## Contexto e Problema
No Navalhado, a gestão de clientes e a relação entre profissionais e serviços precisavam evoluir além do CRUD básico para atender à dinâmica real das barbearias (pesquisa de engenharia reversa do AppBarber e validações de mercado com barbeiros).
Os clientes precisam de um dossiê operacional completo (Central 360) no painel do Gerente sem impor burocracia no agendamento público (Perfil Progressivo).
Além disso, cada profissional possui ritmo de trabalho e acordos de comissão próprios, necessitando de autonomia para definir sua própria duração por serviço, tendo como padrão do sistema a duração de 40 minutos.

## Decisões Tomadas

1. **Perfil Progressivo e Central 360 do Cliente**:
   - O agendamento público e o WhatsApp exigem apenas Nome e Telefone.
   - A tabela `public.customers` recebe campos estratégicos: `birth_date` (data de nascimento para régua de parabéns/desconto), `tags` (etiquetas coloridas com índice GIN), `acquisition_channel` (canal de aquisição) e `cpf` (opcional).
   - Elimina-se a exigência de foto de cliente.
   - A Central 360 do Cliente no painel do Gerente consolida 3 abas: Dados Cadastrais, Histórico Unificado (agendamentos e comandas) e Métricas de LTV/Frequência.

2. **Associação Granular N:N (Tabela `professional_services`)**:
   - Criada a tabela `public.professional_services` com chaves estrangeiras para `professionals` e `services`, com isolamento multi-tenant (`tenant_id`).
   - Herança inteligente: os serviços possuem duração e comissão padrão (duração padrão do sistema definida em 40 minutos).
   - Sobrescrita e Autonomia: o profissional pode personalizar sua própria duração (`custom_duration_minutes`) e comissão (`custom_commission_percentage`) para cada serviço.
   - O motor de agendamento (`get_available_slots`) consulta prioritariamente a duração customizada do profissional selecionado.

## Consequências
- Fricção zero para o cliente no agendamento.
- Eliminação de conflitos de agenda entre profissionais com ritmos diferentes.
- Cálculo automatizado e justo de comissões no fechamento de comandas.
