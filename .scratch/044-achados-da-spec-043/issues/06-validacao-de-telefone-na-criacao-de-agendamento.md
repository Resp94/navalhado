# 06: Validação de telefone na criação de Agendamento conta dígitos

**What to build:** ao criar um Agendamento com Cliente novo, a função do gestor recusa telefone curto. A intenção é exigir DDD e mais oito dígitos, mas a expressão usada para limpar o telefone não remove nada: com as regras padrão de texto do Postgres, ela procura uma barra invertida seguida da letra `D`, e não "qualquer caractere que não é dígito". O resultado é que a validação conta o comprimento bruto do texto, com máscara e tudo.

Na prática, um telefone mascarado passa por ter muitos caracteres, e um texto de dez ou mais caracteres sem nenhum dígito também passa. A tela valida corretamente antes de chamar, então isso não aparece no uso normal; o furo está na última linha de defesa, que é justamente a que precisa valer para qualquer chamador.

Depois deste ticket, a função conta dígitos de verdade.

**Onde foi achado:** revisão do corpo da função durante o ticket 07 da spec 043, que a reescreveu por outro motivo e preservou o corpo como estava. O ramo inalcançável foi notado na conferência de 2026-09-21: a coluna do profissional é obrigatória na tabela de Bloqueios de Horário.

**Blocked by:** 01 (Provas de banco da spec 043) — o teste de banco desta função precisa estar verde antes de ela ser alterada

**Status:** done

- [x] A validação passa a contar os dígitos do telefone, ignorando máscara, espaço, parêntese, traço e sinal de mais
- [x] Telefone com DDD e oito dígitos é aceito, com e sem máscara
- [x] Telefone com nove dígitos no total é recusado, com e sem máscara
- [x] Texto sem nenhum dígito é recusado, por mais longo que seja
- [x] A mensagem de recusa não muda, porque a tela já a exibe
- [x] O restante do corpo da função não é alterado, incluindo a marca de Agendamento vindo da Lista de Espera e a baixa da entrada
- [x] As permissões de execução da função ficam idênticas às de antes
- [x] pgTAP cobrindo aceito com máscara, aceito sem máscara, recusado por faltar um dígito e recusado por não ter dígito nenhum
- [x] A criação de Agendamento com Cliente já cadastrado continua sem passar pela validação de telefone
- [x] O ramo da função que trata Bloqueio de Horário sem profissional, inalcançável porque a coluna do profissional é obrigatória, é removido ou mantido com a razão registrada neste ticket; se removido, a recusa por horário bloqueado continua provada no pgTAP
- [x] `npm run lint`, `npm test` e `npm run build` passam

**Resultado (2026-09-22):**

- **Causa confirmada no banco:** `regexp_replace('(11) 98765-4321', '\\D', '', 'g')` devolve a string inteira, sem tirar nada — o literal `'\\D'`, com `standard_conforming_strings` ligado, vira o texto de dois caracteres barra-invertida seguida de `D`, e o motor de regex procura essa sequência literal, que não existe num telefone. `regexp_replace('(11) 98765-4321', '\D', '', 'g')` (uma barra) devolve só os dígitos. A correção é trocar `'\\D'` por `'\D'`, um caractere.
- Migration `supabase/migrations/20260922100000_044_ticket06_validacao_telefone_criacao_agendamento.sql`, aplicada no ambiente de desenvolvimento. Grants conferidos antes e depois: `authenticated`, `postgres`, `service_role`, sem `anon` — idênticos.
- **Ramo morto removido:** `or b.professional_id is null` na checagem de Bloqueio de Horário. A coluna é `not null` na tabela (conferido no banco); o ramo nunca era alcançado. Conferido depois da migration: `b.professional_id is null` não existe mais no corpo da função; `\D` (barra simples) está presente.
- pgTAP 46 ampliado de 24 para 31 asserções (7 novas): aceita 10 dígitos com máscara e sem máscara (com o `is` de contagem confirmando que o Cliente foi criado em cada caso), recusa 9 dígitos com máscara e sem máscara, recusa texto sem nenhum dígito por mais longo que seja. Rodado inteiro pelo servidor MCP com o harness (`scripts/pgtap-report.mjs`): **31/31**.
- **Vermelho provado por mutação:** antes de aceitar como correto, recriei a função antiga (`'\\D'`) numa transação com `rollback` e chamei com o telefone `'ligar-na-barbearia'` — passou (`{"ok": true}`), confirmando que o bug existia e que os testes novos o pegariam. Depois de commitado, conferi de novo que a função em produção do ambiente de desenvolvimento segue com a correção (`\D` presente).
- **Achado durante a escrita do teste, sem relação com o bug:** a tabela `customers` tem um índice único `customers_tenant_telefone_normalizado_uidx` em `(tenant_id, telefone_normalizado)`. O primeiro rascunho do teste usava dois telefones que normalizavam para o mesmo número (mascarado e sem máscara), e a segunda inserção falhou por violação de unicidade — nada a ver com a validação de dígitos. Corrigido usando números diferentes nos dois casos de aceite.
- **Achado, também sem relação com o bug:** o segundo horário de aceite escolhido inicialmente (`t_1630` + 2 horas = 18:30) caiu fora da escala pessoal do profissional de teste (09:00–18:00, embora o expediente da barbearia vá até 20:00) e a inserção falhou por `private.validate_appointment_schedule_boundaries`. Corrigido usando `t_1630` − 3 horas (13:30–14:00), que não colide com nada.
- Suíte completa da aplicação: 109 arquivos, 1193 testes (nenhum teste de aplicação mudou; a mudança é só de banco). `npx tsc -b`: 0 erros. `npx oxlint`: exit 0, os mesmos 47 avisos preexistentes. `npm run build`: build 0.
- Contagens do banco no ambiente de desenvolvimento, conferidas depois de toda a verificação: `tenants=3, appointments=35, customers=6, professionals=6, services=11, waiting_list=0, blocked_slots=0` — idênticas à linha de base do ticket 01. Todo teste rodou dentro de transação desfeita; nada ficou para trás.
- Migration só aplicada no ambiente de desenvolvimento; a aplicação em produção fica adiada por decisão do responsável (ver Out of Scope da spec 044), sem ticket próprio enquanto ele não decidir promover.
