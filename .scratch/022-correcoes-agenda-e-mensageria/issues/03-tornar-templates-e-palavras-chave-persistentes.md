# 03 — Tornar templates e palavras-chave persistentes

**What to build:** uma tela de WhatsApp que salva e reapresenta de forma determinística a personalização da Instância WhatsApp do tenant, sem restaurar valores padrão quando o gerente deixou um campo vazio.

**Blocked by:** 01 — Auditar baseline dos snapshots e migrations.

**Status:** done

- [x] O salvamento grava somente na Instância WhatsApp pertencente ao tenant autenticado.
- [x] Enquanto uma gravação estiver em andamento, a ação não permite mutações concorrentes desnecessárias.
- [x] A resposta confirmada pelo banco atualiza o estado exibido e uma nova entrada na tela mantém exatamente o valor persistido.
- [x] Troca de aba, reload e nova consulta não restauram um rascunho antigo nem a lista padrão quando `auto_reply_keywords` estiver vazio ou `NULL`.
- [x] A remoção de uma palavra específica, como `link`, permanece removida após salvar e recarregar.
- [x] O preview utiliza o mesmo resultado observável que o renderer de mensagens, respeitando templates com e sem `{link}`.
- [x] A personalização continua isolada por tenant e não expõe tokens, secrets, JWTs ou telefone completo.
- [x] Os testes frontend e de persistência cobrem sucesso, erro, reload, troca de aba, tenant incorreto e tentativa de cliques repetidos.

## Result

- A tela agora respeita `NULL` como lista vazia, filtra o update pelo tenant e reconcilia o draft com a resposta persistida.
- Um `ref` impede gravações concorrentes antes da atualização do estado React.
- A orientação da tela e os documentos de contrato agora explicam a política separada da primeira mensagem do dia.
- Validação: `Whatsapp.test.tsx` passou com 23 testes; a suíte frontend completa, lint e build TypeScript/Vite passaram.
