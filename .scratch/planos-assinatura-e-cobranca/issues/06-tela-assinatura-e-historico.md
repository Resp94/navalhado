# 06: Tela Assinatura e histórico de cobranças (05b)

Parte da spec 052 (Planos, assinatura e cobrança recorrente).

**What to build:** em Configurações, o Gerente vê a própria assinatura: plano, situação, dias de teste restantes, próxima cobrança, final do cartão e o histórico de cobranças.

- Módulo de assinatura no front, no padrão Repository com adaptador Supabase e adaptador em memória para os testes.
- A tela Assinatura substitui a seção mínima do ticket 05 e mostra:
  - plano e preço
  - situação, em linguagem de gente: em teste até DD/MM, ativa, pagamento recusado, cancelada até DD/MM, cortesia
  - próxima cobrança
  - bandeira e final do cartão
  - histórico com valor, data, situação e tipo (mensalidade ou diferença de plano)
- O botão "Assinar" aparece quando não há assinatura ativa. As ações de trocar cartão, mudar de plano, cancelar e exportar dados entram nos próprios tickets, e a tela reserva o lugar delas.
- A tela lê o histórico gravado pelo webhook e não consulta o Mercado Pago a cada abertura.

**Blocked by:** 05 (Assinar pelo Mercado Pago, 05a)

**Status:** done

- [x] Teste do módulo com o adaptador em memória: lê assinatura e histórico do próprio tenant
- [x] Teste da tela: mostra cada situação com o texto certo, a próxima cobrança, o final do cartão e o histórico; mostra "Assinar" só sem assinatura ativa
- [x] Conferido no DEV com a assinatura de teste do ticket 05: a tela mostra a cobrança aprovada
- [x] `npm run lint`, `npm test` e `npm run build` passam

## Resultado (2026-09-29)

Implementado só no front (sem migration nem função nova) e conferido no DEV com a assinatura de teste do ticket 05.

- **Módulo `assinatura`.** `IAssinaturaAdapter` ganhou `obterAssinatura(tenantId)` e `listarCobrancas(tenantId)`; adaptador Supabase (lê `tenant_subscriptions` com o plano e `billing_charges`, as 50 cobranças mais recentes, nunca o Mercado Pago), adaptador em memória (por barbearia) e repositório (exige o id da barbearia, ordena o histórico da mais recente para a mais antiga). `apresentacaoDaAssinatura.ts` guarda os textos: situação em linguagem de gente, próxima cobrança, cartão, situação e tipo da cobrança. `useMinhaAssinatura(tenantId)` lê a assinatura e o histórico em paralelo; falha só no histórico mantém a assinatura na tela.
- **Tela.** `SecaoAssinatura` (em Configurações, último card, agora com `tenantId`) mostra plano e preço, situação (em teste até DD/MM com os dias que restam, ativa, pagamento recusado, cancelada até DD/MM, cortesia, bloqueada), próxima cobrança, bandeira e final do cartão e o histórico (data, valor, situação, tipo, cartão). "Assinar" (em teste e bloqueada) ou "Assinar de novo" (cancelada) só aparece sem assinatura ativa. O lugar das ações dos tickets 09 a 12 e 14 está marcado em comentário no componente.
- **Próxima cobrança.** Ativa: fim do período pago. Em teste: só depois que o cartão foi autorizado no Mercado Pago (aí é o fim do teste); antes disso não há cobrança marcada. Recusada, cancelada, cortesia e bloqueada: nenhuma. Só aparece se a data for futura: data vencida quer dizer pagamento ainda não processado.
- **Em teste com o cartão autorizado** (bandeira gravada): a tela não oferece "Assinar", porque a assinatura já existe no Mercado Pago e um novo clique só levaria a uma recusa 409.
- **Voltando do Mercado Pago** (`?assinatura=retorno`): a tela relê a assinatura a cada 5 s, por 2 minutos, enquanto o pagamento não aparece (ativa ou em teste com o cartão autorizado); depois disso, o botão "Atualizar situação". `useRetornoDoPagamento` é o mesmo hook do porteiro.
- **Datas** no fuso da barbearia (`tenant.timezone`, Brasília se faltar).
- **Defeito achado no DEV.** Desde o ticket 03 a `tenant_subscriptions` tem duas chaves para `plans` (`plan_id` e `scheduled_plan_id`), e o embed `plans(...)` do PostgREST falha por ambiguidade ("more than one relationship was found"). Além da tela nova, atingia a cota de profissionais (`SupabasePlanosAdapter.obterDoTenant`) e o nome do plano no onboarding (`OnboardingWizard`), que falhavam em silêncio. Os três agora usam `plans!tenant_subscriptions_plan_id_fkey(...)`, cada um com teste que recusa o embed sem a dica (mutação conferida no onboarding).
- **Testes.** Vitest: adaptador Supabase e em memória, repositório, `apresentacaoDaAssinatura`, `useMinhaAssinatura`, `SecaoAssinatura`, `Configuracoes`, `SupabasePlanosAdapter`, `OnboardingWizard`. Suíte completa, `oxlint` sem avisos novos, `tsc -b` e `npm run build` passam.
- **DEV.** "Barbearia MP Teste" (plano Tesoura, ativa): a tela mostra "Tesoura, R$ 59,90 por mês", "Ativa", próxima cobrança "R$ 59,90 em 29/10/2026", "Visa final 5682" e uma linha no histórico (29/09/2026, R$ 59,90, Paga, Mensalidade). No celular (375 px) a tabela rola na horizontal e Data, Valor e Situação ficam à vista.

### Fica para depois
- Barbearia sem linha de assinatura vê "sem assinatura" e nenhum botão: a função `billing` só cria assinatura para quem já tem plano (todas as barbearias ganham uma no cadastro desde o ticket 03).
- Em teste com o cartão autorizado, se a assinatura for cancelada direto no Mercado Pago (fora do Navalhado), a tela continua sem "Assinar" até o teste acabar e a barbearia bloquear; o cancelamento pelo aviso do Mercado Pago é o ticket 12.

