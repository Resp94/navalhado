# 05: Promoção para a PROD

Parte da spec 053 (Fechar o token da Instância WhatsApp no navegador).

**What to build:** o fechamento chega à PROD (`boakqstrdfqmsrwnjore`) na ordem certa e com a conferência de que a PROD tem o mesmo problema e a mesma versão do Realtime. Nada neste ticket toca a PROD sem pedido explícito do usuário no momento de cada passo.

- **Leitura (só `SELECT` por `execute_sql`; só depois de o usuário autorizar a consulta à PROD):**
  - `relacl` da tabela e `has_column_privilege` de `authenticated` e `anon`, por coluna (a "Consulta de conferência" da spec, com INSERT acrescentado para `authenticated`)
  - as policies da tabela e se a RLS é forçada
  - a publicação `supabase_realtime` (colunas e `REPLICA IDENTITY`) e se o código da `realtime.apply_rls` de lá filtra por `has_column_privilege` e exige SELECT na chave primária, como a do DEV
  - funções e policies que citam `whatsapp_instances`, e views que dependem dela (esperado: só `view_tenants_management`, `security_invoker`, lendo `status` e `tenant_id`)
  - se as colunas `environment` e as funções do ticket 13 já existem (esperado: não)
  - o resultado vai para a seção "Estado da PROD" da spec 053
- **Passo 1 na PROD.** A migration do ticket 02, idempotente, por `apply_migration`, com o comando explícito do usuário. A tela que está na PROD só lê e grava colunas da lista, então pode ir antes de qualquer outra coisa. Conferir depois, por consulta, que o contrato bate (20 de leitura, 18 de escrita, nenhum privilégio de tabela).
- **Tela e Edge Function (ticket 03).** Chegam à PROD pelo caminho normal de promoção (merge de `dev` em `main` com `--no-ff`, push da `main` e publicação da função com `verify_jwt` inalterado), cada passo só quando o usuário pedir. Conferir a tela no ar antes de seguir.
- **Passo 2 na PROD.** A migration do ticket 04, só depois de a tela e a função novas estarem publicadas na PROD.
- **Quando o ticket 13 chegar à PROD,** a coluna `environment` nasce fechada, porque a tabela já não tem GRANT de tabela. Nada a fazer, mas conferir com o `has_column_privilege`.
- **Desfazer.** Se a tela da PROD der 42501 por uma coluna que ficou de fora, a correção é conceder aquela coluna (`grant select (coluna)` ou `grant update (coluna)`), nunca a tabela. Reabrir o GRANT de tabela devolve o token ao navegador.

**Blocked by:** 02 (Fechar as colunas da instância no banco) para o passo 1; 03 e 04 para o passo 2. Depende da autorização do usuário para tocar a PROD.

**Status:** needs-human (depende da autorização do usuário para consultar e alterar a PROD)

- [ ] Usuário autoriza a consulta de leitura à PROD; resultado registrado na spec 053
- [ ] Usuário autoriza o passo 1; migration aplicada e contrato conferido por consulta
- [ ] Tela e Edge Function do ticket 03 publicadas na PROD (cada push e cada publicação com confirmação do usuário)
- [ ] Usuário autoriza o passo 2; migration aplicada e contrato conferido por consulta
- [ ] O Gerente de uma barbearia da PROD abre `/whatsapp`, vê o status e salva um modelo (feito pelo usuário, que digita a própria senha)
- [ ] Resultado, horários e versões registrados na spec 053
