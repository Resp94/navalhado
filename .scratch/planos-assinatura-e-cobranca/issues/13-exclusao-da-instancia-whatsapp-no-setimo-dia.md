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

**Status:** in-progress

- [x] Teste Deno com o provedor falso: a ação exclui no provedor e remove a instância local; recusa chamada sem o segredo interno
- [x] pgTAP da rotina: escolhe só tenant com 7 dias ou mais de bloqueio; não escolhe instância de outro ambiente nem sem identificação
- [x] Conferido no DEV por consulta: todas as instâncias identificam o ambiente; nenhuma instância de prod é tocada
- [x] `npm run lint`, `npm test` e `npm run build` passam

## Resultado (2026-10-01)

**Banco** (1 migration, aplicada no DEV): `052_ticket13_exclusao_da_instancia_whatsapp` (`20261001181238`).
- `whatsapp_instances.environment` (texto, `dev` ou `prod`). O banco sabe o próprio ambiente pelo Vault (`app_environment`, criado à mão em cada ambiente antes da migration, como o `project_url`; a migration para se faltar ou se não for `dev` nem `prod`). Um gatilho `BEFORE INSERT` marca a instância nova (quem informa o ambiente, como uma restauração de outro banco, mantém o que informou) e a migration marca as que existiam.
- `private.whatsapp_instance_deletion_verdict(id, agora)` é a regra única: `due` só para a instância deste ambiente cuja barbearia está `blocked` há 7 dias ou mais (`blocked_at <= agora - 7 dias`, qualquer motivo de bloqueio). Respostas de recusa: `not_found`, `unidentified` (sem marca), `runtime_unidentified` (o banco não sabe o próprio ambiente), `other_environment`, `not_blocked`, `too_recent`. A ordem é a da segurança: ambiente primeiro, bloqueio depois.
- `private.whatsapp_instances_due_for_deletion` (as devidas) e `private.delete_blocked_whatsapp_instances`, a rotina diária (`delete-blocked-whatsapp-instances`, 03:15 UTC, dez minutos depois da que grava o bloqueio): um `net.http_post` por instância devida para `/functions/v1/whatsapp-integration/delete-instance`, com `x-db-trigger-secret` do Vault (`whatsapp_db_trigger_secret`, o mesmo das outras rotinas do WhatsApp). Falha com exceção se faltar um dos segredos (o job aparece com erro no histórico do pg_cron).
- `public.whatsapp_instance_deletion_verdict(id)`: o mesmo veredito para a função do WhatsApp, só `service_role`.
- pgTAP 75 (26 asserções, 26 ok no DEV): marca do ambiente (gatilho, valor informado mantido), um veredito para cada resposta, a escolha da rotina (só as devidas; teste vencido, bloqueio do Proprietário e pagamento recusado contam), a fila do `pg_net` (uma chamada por instância devida, com a URL do projeto e o segredo), o job agendado, o acesso (só `service_role`; Gerente logado e Gerente com `tenant_id` nulo recusados com `42501`), e a rotina que para sem o segredo ou sem o ambiente no Vault. A referência do histórico de envios (`whatsapp_message_idempotency`) fica nula ao apagar a instância (`ON DELETE SET NULL`, conferido por consulta ao catálogo).

**Função `whatsapp-integration`:** rota `POST /delete-instance`, só com o segredo interno (o Gerente com sessão e sem o segredo recebe 401; segredo em branco na configuração, 500). Lê a instância, consulta o veredito e só continua se for `due` (senão 409 com o motivo, sem tocar o provedor); exclui no provedor com o token da própria instância (`DELETE /instance`; 404 = já excluída, segue) e só então remove a linha local. Falha do provedor (inclusive 401 e tempo esgotado) = 502 e a linha fica, a rodada do dia seguinte tenta de novo. Falha ao remover a linha local depois de o provedor excluir = 500 (no dia seguinte o provedor responde 404 e a linha sai). Testes Deno: 12 novos (rota e adaptador), suíte do WhatsApp 110/110.

**Front:** nada muda. Sem instância, a tela do WhatsApp já mostra "Ativar Integração do WhatsApp" (o teste existente de `Whatsapp.test.tsx` cobre o caso).

### Decisões
- **A marca do ambiente é uma coluna, e não o nome da instância** (a spec dizia "nome"). O nome é a chave que a Uazapi devolve no webhook e existe lá; renomear só no banco quebraria o vínculo, e uma migration não chama o provedor. A Uazapi já recebe o ambiente em `adminField02` na criação, mas isso não é consultável pelo banco.
- **O banco decide e a função confere de novo.** A rotina escolhe e chama; a função pergunta ao banco outra vez antes de excluir, porque a barbearia pode ter pago entre as duas coisas. Uma regra só (a mesma função serve a rotina e a RPC), então o pgTAP prova a regra e o Deno prova que a função a obedece.
- **O ambiente vem do Vault do banco, e não do `APP_ENV` da função.** O `APP_ENV` tem padrão `dev` quando falta, e uma prod com a variável esquecida marcaria tudo como `dev`. Com o Vault, o banco que roda a rotina é o que diz o que é "deste ambiente". Sem o segredo, o banco não marca e a rotina não exclui nada (falha para o lado seguro).
- **A chamada é assíncrona** (`pg_net`): o banco não espera a resposta. A instância que não saiu segue devida e entra na rodada seguinte; não há contador de tentativas.
- **404 do provedor é "já excluída"; 401 não.** Não sei o que a Uazapi responde para o token de uma instância que já não existe (pode ser 401). Tratar 401 como excluída arriscaria apagar a linha de uma instância que continua ocupando vaga (token errado), então ele fica como falha do provedor: a rotina insiste todo dia e o log mostra.

### Limitações
- **Os modelos de mensagem e os ajustes do WhatsApp moram na linha da instância** (`template_*`, `send_*`, `reminder_hours`, palavras-chave) e saem com ela: quem volta depois de 7 dias reconecta com os modelos padrão. A spec manda remover a instância local; guardar os modelos pediria outro lugar para eles.
- **A primeira rodada em prod pode excluir várias de uma vez**, as das barbearias bloqueadas há mais de 7 dias antes da publicação (Proprietário que bloqueou à mão, por exemplo). Conferir antes com `select count(*) from private.whatsapp_instances_due_for_deletion()`.
- **A exclusão de verdade no Uazapi ainda não foi exercitada** (só o provedor falso e a conferência do que o banco enfileira).
- **O navegador consegue gravar a coluna `environment`** (e ler e gravar o `instance_token`). Achado que já existia: as migrations 036 e 051 deram `GRANT SELECT, UPDATE` na tabela inteira a `authenticated`, desfazendo o fechamento por coluna da 009. Um Gerente mal-intencionado poderia limpar a marca da própria instância para que ela nunca seja excluída (a falha é para o lado seguro: nada é excluído a mais). Os testes legados `security_hardening` (asserção 7) e `whatsapp_neutral_persistence` (para na linha 15, `has_constraint` não existe no pgTAP instalado) já falhavam antes desta branch. Ficou para uma spec própria (tarefa aberta); ela deve deixar `environment` e `instance_token` fora do UPDATE do navegador.
- **Regressão conferida no DEV:** `whatsapp_instance_lifecycle` e `establishment_onboarding_wizard` verdes, pgTAP 65 com 73/73 (sem mudança), `security_hardening` com as mesmas 2 falhas de antes (token legível pelo navegador e leitura de pagamentos do barbeiro, achado conhecido).

### Para publicar em prod
Criar o segredo do Vault da prod antes da migration: `select vault.create_secret('prod', 'app_environment', 'Ambiente deste banco (dev ou prod)...')`. Depois, a migration `052_ticket13_exclusao_da_instancia_whatsapp` (depois das dos tickets 02 a 12) e a função `whatsapp-integration`, nessa ordem (a rotina só chama a rota quando há instância devida, então a função pode vir logo depois). Conferir por consulta: nenhuma instância sem `environment`, e `select count(*) from private.whatsapp_instances_due_for_deletion()` com o número esperado.
