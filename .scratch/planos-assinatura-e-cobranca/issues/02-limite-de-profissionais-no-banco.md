# 02: Limite de profissionais no banco e cota na tela

Parte da spec 052 (Planos, assinatura e cobrança recorrente).

**What to build:** a barbearia não passa do número de profissionais ativos do seu plano, venha o cadastro de onde vier, e o Gerente vê quantas vagas ainda tem.

- Um gatilho em `professionals` recusa incluir um profissional ativo, e recusa reativar um profissional excluído, quando a barbearia já está no limite do plano da sua assinatura.
- Profissional ativo é o que não tem `deleted_at`. O Gerente conta só quando existe um profissional ativo vinculado a ele. Isso sai da própria contagem, sem regra especial.
- A recusa usa uma mensagem de erro própria.
- O onboarding e a tela de Profissionais mostram a cota ("3 de 5 profissionais") e traduzem o erro para uma mensagem amigável, com convite para subir de plano. Hoje o onboarding verifica o limite só no front; essa verificação passa a usar a mesma regra do banco.

**Blocked by:** 01 (Catálogo Tesoura, Máquina e Bancada)

**Status:** done

- [x] pgTAP (numeração seguindo a maior existente, dentro de `begin; ... rollback;`):
  - cadastra até o limite e recusa o seguinte
  - reativar profissional excluído conta e é recusado no limite
  - o Gerente vinculado como profissional conta; o Gerente sem vínculo não conta
  - uma barbearia não é afetada pelo limite de outra
- [x] Teste da tela de Profissionais: mostra a cota e a mensagem amigável quando o banco recusa por limite
- [x] Teste do onboarding: mostra a cota e a mensagem amigável no limite
- [x] Conferido no DEV: nenhum tenant existente fica acima do limite do seu plano; se algum ficar, fica registrado no resultado e nenhum profissional é desativado
- [x] `npm run lint`, `npm test` e `npm run build` passam

## Resultado (2026-09-29)

- **Migration** `052_ticket02_limite_de_profissionais_do_plano` aplicada no DEV (`selvxobcjbkligxighlp`), versão `20260929175612`. Cria `private.enforce_professional_plan_limit` (SECURITY DEFINER, `search_path` vazio, sem execute para `PUBLIC`, `anon` e `authenticated`) e o gatilho `trg_enforce_professional_plan_limit`, `BEFORE INSERT OR UPDATE OF deleted_at, tenant_id` em `professionals`.
- **Regra.** Recusa incluir profissional ativo, reativar profissional excluído e mover profissional ativo para outra barbearia quando ela já está no limite do plano. Erro: SQLSTATE `53400`, mensagem `PROFESSIONAL_LIMIT_REACHED`, detalhe com o plano e o limite. O plano é o da assinatura mais recente do tenant. Um `SELECT ... FOR NO KEY UPDATE` na barbearia serializa cadastros simultâneos sem bloquear os inserts de agendamento, cliente e comanda dela, que tomam `FOR KEY SHARE` na mesma linha e conflitariam com um `FOR UPDATE`.
- **pgTAP 64** (novo, 20 asserções, 20/20), incluindo: cadastra até o limite e recusa o seguinte; a recusa não grava nada; excluído libera a vaga; reativar no limite é recusado e com vaga livre é aceito; lote de 6 numa Máquina é recusado por inteiro; uma barbearia não é afetada pelo limite de outra; Gerente sem vínculo não conta e Gerente vinculado conta; mover profissional para barbearia cheia é recusado; barbearia sem assinatura não tem limite; o Gerente autenticado, com a RLS valendo, é barrado pelo limite (e não por permissão); a função do gatilho não é executável por `anon` nem por `authenticated`.
- **Conferido no DEV por consulta.** Nenhum tenant acima do limite: Barber Test 1 de 10 (Bancada), Barbearia Alpha Dev 2 de 5 e Barbearia Teste Navalhado 2 de 5 (Máquina). Nenhum profissional foi desativado. Gatilho ativo, nenhuma sobra de teste.
- **Módulo `planos`:** ganhou a leitura do plano da barbearia (`obterPlanoDoTenant`, com a mesma escolha do gatilho: assinatura mais recente), o hook `usePlanoDoTenant`, o tradutor do erro do banco (`ehErroDeLimiteDeProfissionais`, `mensagemDeLimiteDeProfissionais`) e `ehOMaiorPlano`. Os hooks compartilham um único repositório (`repositorio.ts`) e o tipo `PlanosStatus` mora em `types.ts`. O plural ficou num helper só, `pluralizar` em `src/lib/plural.ts`.
- **Detecção do erro.** A mensagem `PROFESSIONAL_LIMIT_REACHED` manda; o código `53400` só vale quando a mensagem não veio, porque 53400 é uma classe genérica do Postgres e não pode esconder outro erro atrás do limite.
- **Tela de Profissionais** mostra "N de M profissional(is)" e o nome do plano, um aviso quando a equipe enche as vagas e traduz a recusa do banco em mensagem amigável. Com a cota cheia, "Novo Barbeiro" avisa o limite e não abre o formulário, em vez de deixar o gerente preencher tudo para ser recusado no fim. Sem o plano carregado, mostra só a contagem de barbeiros, como antes. Outros erros ao salvar mantêm a mensagem genérica.
- **Mensagem de limite.** Convida a mudar para um plano maior. No maior plano do catálogo (hoje o Bancada) não há para onde subir, então manda falar com o suporte.
- **Onboarding** usa a mesma mensagem no lugar do texto que mandava "solicitar upgrade após a finalização" (a tela de upgrade só existe a partir do ticket 10) e traduz a recusa do banco ao concluir. Serviços e profissionais passam a ser gravados por `upsert` no id que o próprio wizard já gera para cada item, então tentar concluir de novo depois de uma falha atualiza os mesmos registros em vez de duplicá-los.
- `CONTEXT.md` ganhou o termo Limite de Profissionais do Plano.

### Decisões que valem lembrar

- **Inativo não libera vaga.** Profissional com `is_active = false` e sem `deleted_at` continua contando, porque a decisão foi contar só `deleted_at`. Para liberar uma vaga é preciso excluir. Se isso incomodar quem tira um barbeiro de férias, é uma decisão de produto a rever.
- **Sem assinatura, sem limite.** Uma barbearia sem assinatura não é barrada. No fluxo real todo tenant nasce com assinatura, e o bloqueio de acesso fica no ticket 03.
- **Descida de plano agendada** (ticket 11) ainda não entra: o limite vale o do plano atual.
- **A função do gatilho foi ajustada no DEV por SQL** depois de aplicada a versão `20260929175612` (`FOR UPDATE` virou `FOR NO KEY UPDATE`). O arquivo da migration já tem a versão final, que é a que vai para prod.

### Limitação conhecida

- **O onboarding continua sem ser transacional.** Ele grava serviços, profissionais e o tenant em chamadas separadas. O `upsert` pelo id torna o retry seguro (sem duplicar), mas uma falha no meio ainda deixa o que já foi gravado. Se o gestor remover um item depois da falha, o item removido continua gravado, porque o retry só atualiza os ids que ainda estão na lista. Gravar tudo numa transação exigiria uma função nova no banco, com guarda de acesso, o que precisa de spec e ticket próprios.
