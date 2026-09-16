-- Habilita o pgTAP para os testes transacionais do banco.
-- A extensão fica no schema não exposto `extensions`, mantendo o public limpo.
create extension if not exists pgtap with schema extensions;
