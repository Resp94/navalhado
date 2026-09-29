# 13: Exclusão da Instância WhatsApp no 7º dia de bloqueio

Parte da spec 052 (Planos, assinatura e cobrança recorrente).

**What to build:** a barbearia bloqueada há 7 dias tem a Instância WhatsApp excluída do servidor Uazapi, liberando a vaga. Os dados da barbearia continuam guardados. Quem volta conecta o WhatsApp de novo pelo fluxo normal.

- A Edge Function do WhatsApp ganha a ação de excluir a instância, chamada só com o segredo interno que as rotinas já usam. A ação exclui no provedor e remove a instância local. Hoje a exclusão na Uazapi só acontece para desfazer uma criação que falhou.
- A rotina diária chama a exclusão para cada tenant com 7 dias ou mais desde a data do bloqueio que ainda tenha instância.
- **Proteção do dev:** o dev usa por enquanto uma instância no mesmo servidor Uazapi de prod. A exclusão só age sobre instâncias cujo nome identifica o ambiente da rotina que está rodando.
  - Se o nome das instâncias ainda não identifica o ambiente, as instâncias novas passam a identificar e as existentes são marcadas por migração de dados.
  - Instância sem identificação de ambiente nunca é excluída pela rotina.
- A tela de WhatsApp do Gerente, ao voltar, mostra o fluxo normal de conexão.

**Blocked by:** 03 (Período de teste, Estado de Acesso e bloqueio do painel)

**Status:** ready-for-agent

- [ ] Teste Deno com o provedor falso: a ação exclui no provedor e remove a instância local; recusa chamada sem o segredo interno
- [ ] pgTAP da rotina: escolhe só tenant com 7 dias ou mais de bloqueio; não escolhe instância de outro ambiente nem sem identificação
- [ ] Conferido no DEV por consulta: todas as instâncias identificam o ambiente; nenhuma instância de prod é tocada
- [ ] `npm run lint`, `npm test` e `npm run build` passam
