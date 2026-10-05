# 02: O cliente responde "SAIR" e para de receber mensagens promocionais

Parte da spec 055 (Conformidade com os novos Termos e Política).

**What to build:** o cliente que manda "SAIR", "PARAR" ou "STOP" para o WhatsApp da barbearia recebe uma confirmação em texto fixo e deixa de receber o lembrete de retorno e as boas-vindas daquela barbearia.

- **Como a palavra é reconhecida:** pela mensagem inteira normalizada, e não por "contém". O descadastro tem precedência sobre a resposta automática por palavra-chave.
- **O que continua chegando:** confirmação, reagendamento, cancelamento, lembrete do horário e mensagem manual do Gerente.
- **O que o Gerente vê:** "Não recebe lembretes de retorno" na ficha do cliente, e pode desfazer isso a pedido dele.
- **Rodapé novo:** o modelo padrão do lembrete de retorno ganha "Para não receber mais lembretes como este, responda SAIR."

Hoje o lembrete de retorno é promocional e não tem saída (LGPD, art. 18, § 2º).

**Blocked by:** None (can start immediately)

**Status:** ready

- [ ] Migration só no DEV: `customers.marketing_opt_out_at timestamptz`; `get_pending_return_reminders` e a fila de boas-vindas ignoram quem a tem preenchida
- [ ] `whatsapp-integration`:
  - reconhece o descadastro numa função pura, coberta pelo Vitest: aceita "sair", " Sair! " e "PARAR"; recusa "vou sair mais cedo";
  - grava a coluna, responde a confirmação e não dispara a resposta automática
- [ ] Modelo padrão do lembrete de retorno com o rodapé. Os modelos personalizados das barbearias não são alterados; anotar no resultado
- [ ] Ficha do cliente (repositório e adaptador de clientes): mostra a marca e permite desfazer
- [ ] pgTAP: o cliente com a coluna sai do lembrete de retorno e das boas-vindas e segue na confirmação e no lembrete do horário; o Gerente de outra barbearia não altera a coluna
- [ ] Nenhum teste no DEV dispara WhatsApp para número real (ver a memória "Teste no dev dispara WhatsApp")
- [ ] Publicar `whatsapp-integration` no DEV só com o OK do usuário
- [ ] Gates de lint, Vitest e build passam
