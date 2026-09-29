# 08: Avisos por e-mail

Parte da spec 052 (Planos, assinatura e cobrança recorrente).

**What to build:** o Gerente é avisado por e-mail, e não só pela faixa do painel, antes de perder o acesso.

- E-mails pelo Resend, no mesmo padrão dos e-mails de autenticação com React Email:
  - 3 dias antes do fim do teste
  - dia da recusa do pagamento
  - 3º dia da recusa
  - 4º dia da recusa: "amanhã o acesso será bloqueado"
  - bloqueio efetivado, com o motivo e o caminho para voltar
- A rotina diária dispara os e-mails de prazo. O webhook dispara o e-mail do dia da recusa.
- Cada e-mail enviado fica registrado por tenant e tipo, para não repetir no mesmo dia.
- Os e-mails vão para o e-mail do Gerente do tenant. No DEV, seguem a regra atual dos e-mails do ambiente.

**Blocked by:** 07 (Pagamento recusado e bloqueio no 5º dia)

**Status:** ready-for-agent

- [ ] Teste dos templates (render): cada e-mail tem o texto, as datas e o link certos
- [ ] pgTAP ou teste Deno: a rotina escolhe quem recebe cada aviso no dia certo e não repete no mesmo dia
- [ ] Conferido no DEV: um tenant de teste recebe o e-mail de fim de teste e o do dia da recusa
- [ ] `npm run lint`, `npm test` e `npm run build` passam
