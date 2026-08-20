# 08 — Experiência Mobile do Barbeiro (Minha Agenda e Minhas Comissões)

**What to build:**
Adaptar as telas do perfil de Barbeiro/Colaborador (`/minha-agenda` e `/minhas-comissoes`) para smartphones (`<= 768px`), garantindo isolamento total (o colaborador não vê dados globais do negócio) e permitindo que ele visualize seus clientes do dia, avance status de atendimento com 1 toque, confira a comissão acumulada hoje e na semana atual, e acesse seu perfil com botão de logout na Bottom Bar simplificada de 3 abas.

**Blocked by:** 01 — Infraestrutura de Layout Base, Bottom Navigation e Modais Bottom Sheet, 03 — Agenda Mobile do Gerente (Carrossel de Barbeiros + Linha do Tempo Vertical)

**Status:** ready-for-agent

- [ ] A tela `MinhaAgenda.tsx` exibe exclusivamente a lista cronológica de atendimentos do profissional logado no dia em cartões verticais ergonômicos.
- [ ] O barbeiro consegue alterar o status do agendamento (Confirmado -> Em Atendimento -> Concluído) e acionar o WhatsApp do cliente diretamente no cartão.
- [ ] A tela `MinhasComissoes.tsx` exibe o total de comissões acumuladas hoje em destaque grande, total de atendimentos realizados e extrato consolidado da semana.
- [ ] A Bottom Bar de 3 abas (*Minha Agenda*, *Comissões*, *Perfil*) navega de forma fluida sem exibir abas gerenciais.
