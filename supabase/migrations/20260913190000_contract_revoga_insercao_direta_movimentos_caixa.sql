-- Ticket 04 da spec 036 (contract): revoga a insercao direta em movimentos de
-- caixa.
--
-- Spec: specs/036-contas-a-pagar/spec.md, secao "Entrega 1 - Apuracao unica do
-- valor esperado da gaveta" (fechamento da brecha de insercao direta; expand
-- e contract).
--
-- Motivo: o ticket 03/036 (expand) ja migrou os chamadores (aba de Caixa) para
-- a RPC public.register_cash_movement, mas manteve a insercao direta permitida
-- para nao quebrar navegadores com a versao anterior do adaptador. Este ticket
-- e o contract: fecha a porta antiga.
--
-- A politica cash_movements_insert_policy so confere tenant, papel e sessao
-- aberta -- ela nunca soube validar saldo nem conferir o autor informado pelo
-- navegador (performed_by vinha do cliente, sem checagem). Restringir a
-- politica a suprimento e sangria nao bastaria: autor e vinculos (quitacao,
-- profissional, estorno) continuariam forjaveis, e cada coluna futura
-- reabriria a brecha. A garantia correta ja vive inteira nas RPCs desde os
-- tickets 01 e 03/036 (register_cash_movement, register_commission_payout,
-- register_professional_advance): travam a sessao, gravam o autor a partir de
-- auth.uid() e validam saldo pela apuracao unica.
--
-- Pre-condicao (fora do alcance desta migracao, verificada pelo humano
-- responsavel antes de aplicar em cada ambiente): o frontend do ticket 03 ja
-- publicado, sem chamador vivo inserindo direto em cash_movements.
--
-- Escopo estrito: so cash_movements. Nenhuma outra tabela financeira tem
-- permissao alterada aqui.
drop policy if exists cash_movements_insert_policy on public.cash_movements;

revoke insert on public.cash_movements from authenticated;
revoke all on public.cash_movements from anon;
