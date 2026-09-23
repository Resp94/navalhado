# 02: Migrations da spec 047 em prod

**What to build:** o banco de prod passa a recusar e-mail mal formado em Cliente, Fornecedor, barbearia e login, com a mesma regra da `dev`. O front antigo segue funcionando por cima do banco mais rígido.

**Blocked by:** 01 (Conferências antes de promover).

**Status:** done

- [x] As 4 migrations (`047_ticket01` a `047_ticket04`) aplicadas em prod na ordem dos arquivos, com o nome do arquivo sem o timestamp como nome da migration
- [x] Parada na primeira migration que falhar, sem aplicar as seguintes
- [x] `public.email_valido` existe, é `immutable` e fixa `search_path` vazio
- [x] `customers_email_format_check`, `suppliers_email_check`, `tenants_email_format_check` e `users_email_format_check` existem e estão validadas
- [x] pgTAP 58 a 61 passam em prod dentro de `begin; ... rollback;`
- [x] Log do Postgres de prod sem erro novo depois das migrations
- [x] Resultado registrado na spec 048
