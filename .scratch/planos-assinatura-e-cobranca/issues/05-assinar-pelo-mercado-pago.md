# 05: Assinar pelo Mercado Pago (05a)

Parte da spec 052 (Planos, assinatura e cobrança recorrente).

**What to build:** o Gerente clica em "Assinar" (ou em "Pagar", na tela de bloqueio), paga na página do Mercado Pago, e a barbearia vira assinatura ativa quando o pagamento é aprovado.

- **Provedor trocável:** o acesso ao Mercado Pago fica atrás de uma interface, no mesmo padrão do provedor de WhatsApp. Ela cobre criar assinatura, trocar cartão, mudar valor, cancelar, cobrar avulso, buscar pagamento e buscar assinatura. Há uma versão real e uma falsa para os testes. Nesta fatia, só criar assinatura, buscar pagamento e buscar assinatura precisam existir de verdade.
- **Edge Function de cobrança**, ação "assinar":
  - só para o Gerente do próprio tenant; recusa Gerente sem tenant
  - cria a assinatura pendente com o e-mail do Gerente, o valor do plano, ciclo mensal e referência externa igual ao id do tenant
  - em teste, o início é o fim do teste; bloqueado, o início é imediato
  - grava o id da assinatura e devolve o link de pagamento do Mercado Pago
  - se já existe assinatura cancelada, a nova é criada e a antiga fica como está
- **Edge Function do webhook**, pública:
  - confere a assinatura secreta do aviso, com o segredo em secret do Supabase
  - grava cada aviso numa tabela de eventos com chave única e ignora aviso repetido
  - busca o recurso no Mercado Pago e decide pelo que ele responde, nunca pelo corpo do aviso
  - responde rápido
  - pagamento aprovado da assinatura: a situação vira ativa e o período pago é preenchido ou avançado
- **Histórico de cobranças:** cada pagamento vira uma linha com valor, data, situação, tipo e final do cartão. A tela que mostra o histórico é o ticket 06.
- **Tela:** um botão "Assinar" numa seção Assinatura mínima em Configurações, e o "Pagar" da tela de bloqueio, os dois abrindo o link do Mercado Pago.
- **Credenciais:**
  - DEV: o token de produção da conta de teste vendedora e a Public Key correspondente
  - o webhook configurado no app da conta de teste vendedora, apontando para o DEV
  - tudo em secret do Supabase; nada de token no front
- O `CONTEXT.md` ganha o termo Assinatura no Mercado Pago, se ainda não houver termo equivalente.

**Blocked by:** 03 (Período de teste, Estado de Acesso e bloqueio do painel)

**Status:** ready-for-agent

- [ ] Teste Deno da ação "assinar" com o provedor falso: em teste manda o início no fim do teste; bloqueado manda início imediato; grava o id da assinatura; recusa Barbeiro, anônimo e Gerente sem tenant
- [ ] Teste Deno do webhook com o provedor falso: recusa assinatura secreta inválida; ignora aviso repetido; busca o recurso no provedor; pagamento aprovado vira ativa com período pago e linha no histórico
- [ ] pgTAP: histórico de cobranças e tabela de eventos legíveis só pelo próprio tenant (o histórico) ou por ninguém do front (os eventos)
- [ ] Teste do front: "Assinar" e "Pagar" chamam a ação e abrem o link devolvido
- [ ] Roteiro manual no DEV com o ambiente de teste do Mercado Pago: assinar em teste mostra "N dias grátis" e não cobra; assinar bloqueado cobra na hora e o webhook libera o acesso
- [ ] `npm run lint`, `npm test` e `npm run build` passam
