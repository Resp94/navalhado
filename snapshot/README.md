# Snapshots operacionais do Navalhado

Esta pasta guarda registros datados do estado funcional conhecido do projeto. Ela funciona como uma memória de segurança para pessoas e assistentes de IA: antes de alterar código, banco, estilos ou fluxos existentes, consulte este arquivo e o snapshot mais recente.

## Regras obrigatórias para assistentes de IA

1. Leia o snapshot mais recente antes de iniciar qualquer alteração.
2. Trate itens `✅ Funcional` como contratos de regressão: a mudança não pode quebrá-los silenciosamente.
3. Preserve as regras de negócio, triggers, RLS, integrações e fluxos já validados.
4. Antes de alterar banco de dados, consulte o estado atual pelo MCP do Supabase. Toda mudança de schema deve ser uma migration versionada.
5. Antes de alterar uma área funcional, execute os testes existentes dessa área e registre a regressão correspondente.
6. Não altere nem apague snapshots antigos. Crie um novo arquivo com a data da nova validação.
7. Diferencie sempre validação visual, teste automatizado e validação de banco. Não marque um item como funcional sem evidência.
8. Registre limitações conhecidas para que outro assistente não interprete uma pendência como comportamento esperado.
9. Se uma alteração quebrar um item do snapshot, pare o trabalho, reproduza o problema, corrija a regressão e valide novamente.
10. O snapshot é local e versionado no repositório. Não publicar seu conteúdo em GitHub ou outro serviço sem solicitação explícita.

## Formato de um novo snapshot

Use `YYYY-MM-DD-nome-curto.md` e inclua:

- data e horário da validação;
- commit de referência e situação do working tree;
- ambiente utilizado, incluindo viewport quando houver validação visual;
- itens funcionais confirmados, cada um com sua evidência;
- regras críticas que devem ser preservadas;
- limitações ou pendências conhecidas;
- testes executados e resultado;
- alterações realizadas desde o snapshot anterior.

## Classificação dos registros

- `✅ Funcional`: validado por teste automatizado, inspeção de banco ou validação visual identificada.
- `⚠️ Parcial`: funciona em um cenário, mas possui cobertura ou validação incompleta.
- `⛔ Pendência`: problema reproduzido ou comportamento ainda não validado.

O snapshot registra evidências; ele não substitui testes automatizados, revisão de código ou validação do banco.
