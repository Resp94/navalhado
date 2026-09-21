# Achados da spec 043

Esta pasta não é uma spec. São os achados, débitos e provas pendentes que a implementação da spec 043 (Motivo de Cancelamento visível) deixou registrados nos próprios tickets, reunidos aqui como trabalho independente. Cada ticket cita onde o achado foi registrado.

Os oito tickets da spec 043 estão fechados e mesclados em `dev`. Nenhum item desta pasta é pré-requisito daqueles; todos são posteriores.

## Ordem sugerida

O número do arquivo é ordem de dependência, não de prioridade.

Comece pelo 01: sem as migrations em produção, o código que já está em `dev` não pode ser promovido. É o único item que bloqueia a entrega.

Depois dele, os de maior risco são o 02 (validação de telefone frouxa no banco), o 05 (exclusão de Bloqueio não chega pelo tempo real, então a recepção vê horário bloqueado como livre) e o 08 (falha silenciosa na leitura de Bloqueios, com o mesmo efeito visível).

Arestas de bloqueio: o 04 espera o 03, e o 12 espera o 09. O resto pode começar a qualquer momento.

## O que não virou ticket

**Botão "Remover" do Bloqueio na Minha Agenda do barbeiro.** Registrado como dúvida no ticket 08 da spec 043. Conferido no banco em 2026-09-21: a política de exclusão de Bloqueio de Horário permite ao barbeiro excluir os do próprio profissional, e a tela só lhe mostra esses. Funciona por desenho; não há defeito.

**Lista de Espera só no gerente.** Registrado no ticket 07 da spec 043 como nota de escopo, não como defeito. Se o barbeiro deve alcançar a Lista de Espera é decisão de produto, e vira spec própria se for o caso.

**As quatro mensagens de WhatsApp enviadas durante o ticket 06.** Durante a verificação, dois Agendamentos de teste inseridos já ativos, numa barbearia com instância de WhatsApp conectada no ambiente de desenvolvimento, fizeram os gatilhos enviarem 4 mensagens reais para o telefone de um cliente real. O envio não se desfaz. As 4 linhas da fila de saída foram mantidas de propósito, como registro do que foi enviado. Apagá-las ou não é decisão do responsável, não trabalho de engenharia. A lição está na memória do projeto e virou critério no ticket 17.

**Higiene do repositório.** `dev` está muitos commits à frente do remoto e nunca houve push; há branches locais já mescladas que podem ser apagadas. São decisões do responsável, não tickets.

## Observação menor, sem ticket

A função de criação de Agendamento pelo gestor tem um ramo que trata Bloqueio de Horário sem profissional (bloqueio da barbearia inteira). A coluna do profissional é obrigatória na tabela, então esse ramo nunca é alcançado. É código morto inofensivo; não justifica ticket sozinho, mas vale remover se alguém mexer na função por outro motivo.
