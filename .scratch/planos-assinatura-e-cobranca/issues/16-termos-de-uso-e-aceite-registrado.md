# 16: Termos de uso e aceite registrado

Parte da spec 052 (Planos, assinatura e cobrança recorrente).

**What to build:** o Gerente aceita Termos de Uso e uma Política de Privacidade que explicam a assinatura, e o aceite fica registrado.

- **Termos de Uso** com as cláusulas:
  - preço e renovação mensal automática
  - teste de 15 dias
  - cancelamento com acesso até o fim do período pago
  - subida de plano com cobrança proporcional
  - descida sem reembolso
  - suspensão no 5º dia de pagamento recusado, com os avisos prévios
  - guarda dos dados sem prazo, com exportação
  - exclusão da Instância WhatsApp no 7º dia de bloqueio
- **Política de Privacidade:** os dados ficam guardados sem prazo depois do cancelamento, com exportação pela tela e exclusão a pedido pelo suporte.
- Os textos têm versão.
- O aceite é gravado por usuário, com a versão e a data.
- O cadastro exige marcar "li e aceito".
- O Gerente que ainda não aceitou a versão atual vê o aceite antes de entrar no painel.
- O texto é um rascunho técnico, revisado por advogado antes do lançamento em prod.

**Blocked by:** 01 (Catálogo Tesoura, Máquina e Bancada)

**Status:** ready-for-agent

- [ ] pgTAP: o usuário grava e lê só o próprio aceite
- [ ] Teste do cadastro: não conclui sem marcar o aceite; grava versão e data
- [ ] Teste do layout do Gerente: sem aceite da versão atual, mostra o aceite antes do painel; com aceite, segue normal
- [ ] Os links de termos e privacidade do login e do cadastro abrem os textos novos
- [ ] Anotado no resultado: o texto precisa de revisão por advogado antes de prod
- [ ] `npm run lint`, `npm test` e `npm run build` passam
