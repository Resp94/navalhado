# 02: Validação de telefone na criação de Agendamento conta dígitos

**What to build:** ao criar um Agendamento com Cliente novo, a função do gestor recusa telefone curto. A intenção é exigir DDD e mais oito dígitos, mas a expressão usada para limpar o telefone não remove nada: com as regras padrão de texto do Postgres, ela procura uma barra invertida seguida da letra `D`, e não "qualquer caractere que não é dígito". O resultado é que a validação conta o comprimento bruto do texto, com máscara e tudo.

Na prática, um telefone mascarado passa por ter muitos caracteres, e um texto de dez ou mais caracteres sem nenhum dígito também passa. A tela valida corretamente antes de chamar, então isso não aparece no uso normal; o furo está na última linha de defesa, que é justamente a que precisa valer para qualquer chamador.

Depois deste ticket, a função conta dígitos de verdade.

**Onde foi achado:** revisão do corpo da função durante o ticket 07 da spec 043, que a reescreveu por outro motivo e preservou o corpo como estava. O ramo inalcançável foi notado na conferência de 2026-09-21: a coluna do profissional é obrigatória na tabela de Bloqueios de Horário.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] A validação passa a contar os dígitos do telefone, ignorando máscara, espaço, parêntese, traço e sinal de mais
- [ ] Telefone com DDD e oito dígitos é aceito, com e sem máscara
- [ ] Telefone com nove dígitos no total é recusado, com e sem máscara
- [ ] Texto sem nenhum dígito é recusado, por mais longo que seja
- [ ] A mensagem de recusa não muda, porque a tela já a exibe
- [ ] O restante do corpo da função não é alterado, incluindo a marca de Agendamento vindo da Lista de Espera e a baixa da entrada
- [ ] As permissões de execução da função ficam idênticas às de antes
- [ ] pgTAP cobrindo aceito com máscara, aceito sem máscara, recusado por faltar um dígito e recusado por não ter dígito nenhum
- [ ] A criação de Agendamento com Cliente já cadastrado continua sem passar pela validação de telefone
- [ ] O ramo da função que trata Bloqueio de Horário sem profissional, inalcançável porque a coluna do profissional é obrigatória, é removido ou mantido com a razão registrada neste ticket; se removido, a recusa por horário bloqueado continua provada no pgTAP
- [ ] `npm run lint`, `npm test` e `npm run build` passam
