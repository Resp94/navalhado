# Estabilização e segurança do financeiro e estoque

**Status:** ready-for-agent
**Ordem:** 1 de 3
**Ambiente inicial:** Supabase DEV
**Dependências:** nenhuma; esta spec prepara as Specs 031 e 032

## Problem Statement

O módulo financeiro está operacional, mas a auditoria do código e do banco DEV encontrou riscos latentes que ainda não aparecem no uso atual por causa do baixo volume de dados e da ausência de produtos cadastrados.

O contrato vigente de movimentação de estoque aceita tipos detalhados e quantidades positivas, enquanto a função remota de ajuste ainda valida tipos antigos e tenta persistir quantidades negativas em saídas. Assim, a primeira operação real de estoque pode falhar mesmo que as telas e os testes isolados continuem aparentando normalidade.

Também existem permissões financeiras que dependem apenas da associação ao tenant. Isso permite que chamadas diretas à API de dados contornem parte das regras aplicadas pelas telas ou pelas funções remotas. O registro de quitação de comissão não valida de forma completa usuário ativo, profissional do tenant, método de pagamento e limite do saldo pendente.

O sistema precisa corrigir esses riscos sem alterar os fluxos que já funcionam, sem reescrever migrations históricas e sem promover mudanças para produção antes de validação completa no DEV.

## Solution

Estabilizar os contratos atuais de estoque e financeiro em uma mudança corretiva, pequena e reversível:

- alinhar a função de ajuste de estoque aos tipos e à regra de quantidade já usados pelo schema e pelo frontend;
- preservar as assinaturas públicas consumidas pelos repositórios atuais;
- restringir operações financeiras sensíveis por usuário ativo, função autorizada e tenant;
- tornar a função de quitação de comissão a única porta de escrita autorizada para o fluxo normal;
- validar profissional, método, valor e saldo antes de registrar uma quitação;
- adicionar testes de caracterização antes das mudanças e testes de regressão depois delas;
- consultar e alterar o banco DEV exclusivamente pelo MCP do Supabase, sempre por nova migration versionada.

O objetivo desta etapa é remover falhas e brechas sem redesenhar a experiência do usuário ou introduzir a atomicidade ampla prevista na Spec 031.

## User Stories

1. Como gerente, quero registrar uma entrada manual de produto, para que o saldo aumente sem erro.
2. Como gerente, quero registrar uma entrada de compra, para refletir a reposição recebida.
3. Como gerente, quero registrar uma saída manual, para corrigir perdas ou baixas justificadas.
4. Como gerente, quero registrar uma saída por uso interno, para manter o saldo físico correto.
5. Como operador, quero que a venda de produto em comanda continue reduzindo o estoque, para preservar o fluxo atual.
6. Como gerente, quero realizar um ajuste de inventário, para alinhar o saldo do sistema à contagem física.
7. Como gerente, quero que toda movimentação mantenha quantidade positiva e direção determinada pelo tipo, para evitar registros ambíguos.
8. Como gerente, quero receber um erro de domínio compreensível ao tentar retirar mais unidades do que o saldo disponível, para não gerar estoque negativo.
9. Como gerente, quero que movimentações inválidas sejam rejeitadas sem alterar o produto ou criar histórico parcial.
10. Como gerente, quero que o histórico informe o tipo detalhado da movimentação, para entender a origem da mudança.
11. Como usuário de um tenant, quero acessar somente os produtos e movimentos da minha barbearia, para preservar o isolamento dos dados.
12. Como usuário inativo, quero ter operações sensíveis bloqueadas, para que uma conta desativada não continue movimentando valores ou estoque.
13. Como barbeiro, quero continuar usando apenas as ações financeiras já permitidas ao meu papel, sem receber permissões administrativas novas.
14. Como gerente, quero registrar uma quitação parcial de comissão, para pagar um profissional em etapas.
15. Como gerente, quero registrar uma quitação total até o saldo pendente, para encerrar corretamente a obrigação.
16. Como gerente, quero que uma quitação acima do saldo pendente seja rejeitada, para evitar saldo negativo artificial.
17. Como gerente, quero que uma quitação para profissional de outro tenant seja rejeitada, para impedir mistura financeira entre barbearias.
18. Como gerente, quero usar somente métodos de pagamento reconhecidos pelo sistema, para manter relatórios consistentes.
19. Como usuário sem papel financeiro autorizado, quero que chamadas diretas de escrita sejam bloqueadas, para que a segurança não dependa apenas da interface.
20. Como proprietário global, quero manter o acesso administrativo já previsto, com validação explícita e auditável.
21. Como responsável técnico, quero preservar os contratos dos repositórios existentes, para reduzir o risco de regressão no frontend.
22. Como responsável técnico, quero uma migration nova e ordenada, para manter o histórico do banco rastreável.
23. Como responsável técnico, quero comparar definições, políticas, grants e advisors antes e depois no DEV, para provar que a mudança ficou restrita ao escopo.
24. Como responsável técnico, quero manter todos os testes atuais verdes, para confirmar que os comportamentos funcionais foram preservados.
25. Como responsável técnico, quero que nenhuma alteração seja aplicada em produção nesta etapa, para validar primeiro com dados controlados.

## Implementation Decisions

### Contrato de estoque

- O schema vigente é a fonte de verdade para os tipos de movimentação: entrada manual, entrada por compra, saída manual, saída por venda em comanda, saída por uso interno e ajuste.
- A quantidade persistida continuará positiva. A direção da variação será calculada pelo tipo da movimentação; saídas não serão representadas por quantidade negativa no histórico.
- A função remota de ajuste será corrigida sem trocar seu nome nem remover parâmetros consumidos pela aplicação. Caso exista parâmetro legado, sua compatibilidade será preservada ou sua transição será explícita e testada.
- A atualização do saldo do produto e a criação do movimento continuarão ocorrendo na mesma transação.
- Estoque negativo será rejeitado no servidor, independentemente da validação da interface.
- A migration corretiva não editará nem apagará a migration que introduziu a regressão.

### Autorização e RLS

- Usuários autenticados precisarão estar ativos e associados ao tenant alvo para operar dados do tenant.
- Papéis autorizados serão verificados no banco para operações sensíveis; valores enviados pelo cliente não serão considerados prova de autorização.
- As policies e grants serão reduzidos ao mínimo necessário por operação, preservando leituras e escritas comprovadamente usadas pelos fluxos atuais.
- Tabelas deliberadamente privadas ao backend continuarão sem acesso direto de clientes; a ausência de policies nelas deverá permanecer documentada como decisão, não como acidente.
- Funções `SECURITY DEFINER` manterão `search_path` fixo, schemas qualificados, validação explícita do chamador e grants restritos.
- A alteração será baseada em inventário obtido pelo MCP no momento da implementação, pois policies, grants e funções podem ter mudado após esta spec.

### Quitação de comissão

- O registro normal de quitação ocorrerá pela função remota validada, e não por inserção direta irrestrita.
- A função exigirá usuário ativo com papel financeiro autorizado no tenant alvo.
- O profissional deverá existir, estar associado ao mesmo tenant e estar apto a receber a quitação.
- O valor deverá ser positivo e não poderá superar o saldo pendente calculado de forma consistente com o contrato financeiro vigente.
- O método deverá pertencer ao conjunto canônico suportado pelo sistema.
- A validação e a inserção ocorrerão atomicamente, evitando dupla quitação concorrente acima do saldo.
- O formato de retorno consumido pela interface atual será preservado sempre que possível.

### Compatibilidade e rollout

- Antes de qualquer alteração, serão capturados testes de caracterização dos comportamentos atuais que precisam permanecer.
- Toda mudança de banco será uma migration nova criada pela ferramenta de migrations, aplicada primeiro no DEV pelo MCP do Supabase.
- A migration terá verificações prévias compatíveis com o estado real do DEV e não dependerá de dados inexistentes.
- Nenhum índice será removido apenas por aparecer como não utilizado. Novos índices dependerão de consulta real e plano de execução.
- A implantação deverá permitir rollback por uma migration compensatória; não haverá edição retroativa do histórico.
- Produção, deploy, dados reais e mudanças visuais ficam fora desta spec.

## Testing Decisions

Um bom teste verificará o comportamento observável do contrato: saldo final, movimento persistido, autorização, isolamento e erro retornado. Não deverá depender da organização interna da função quando a mesma garantia puder ser exercitada pela API pública.

O seam principal será o contrato dos repositórios de Produto e Financeiro. No banco, as funções remotas e as policies serão exercitadas com os papéis reais usando o padrão pgTAP já existente.

### Cenários obrigatórios

1. Cada tipo vigente de movimentação é aceito e produz saldo e histórico corretos.
2. Entrada aumenta saldo; cada saída reduz saldo; ajuste chega ao saldo solicitado conforme o contrato atual.
3. Saída sem saldo suficiente falha sem atualizar produto nem inserir movimento.
4. Tipo antigo ou desconhecido falha sem efeito parcial.
5. Quantidade zero ou negativa é rejeitada.
6. Usuário ativo autorizado opera somente no próprio tenant.
7. Usuário inativo é rejeitado mesmo que ainda possua linha de usuário e sessão válida.
8. Barbeiro, gerente e proprietário recebem exatamente as permissões definidas para seus papéis.
9. Chamadas anônimas e chamadas autenticadas sem associação válida são rejeitadas.
10. Inserção direta em quitação não contorna a função validada.
11. Quitação parcial válida é registrada e reduz o saldo pendente.
12. Quitação total exata é aceita e zera o saldo.
13. Quitação acima do saldo é rejeitada integralmente.
14. Profissional de outro tenant é rejeitado.
15. Método desconhecido é rejeitado.
16. Duas quitações concorrentes não conseguem ultrapassar juntas o saldo disponível.
17. Os adapters continuam enviando e recebendo o formato já esperado.
18. As suítes atuais de Produtos, Comandas, Caixa, Financeiro e Quitação de Comissão permanecem verdes.
19. Os advisors de segurança e performance são comparados antes e depois, sem introduzir novo alerta no escopo.
20. As contagens e amostras de integridade consultadas no DEV permanecem consistentes após a migration.

## Out of Scope

- Tornar o fechamento e a reabertura de comandas atômicos.
- Tornar o fechamento de caixa atômico.
- Criar snapshots históricos de comissão, custo, descontos ou divergência de caixa.
- Redesenhar telas, componentes ou navegação.
- Remover índices apenas por baixa utilização atual.
- Corrigir advisors sem relação com estoque, caixa, comissões ou autenticação financeira.
- Alterar autenticação anônima usada pelo canal público.
- Alterar produção, executar deploy, promover migration ou modificar dados reais.

## Further Notes

- A auditoria do DEV encontrou todas as tabelas públicas com RLS habilitado e nenhuma inconsistência nos agregados financeiros verificados.
- O defeito de estoque está oculto porque o DEV ainda não possui produtos nem movimentos cadastrados.
- As permissões atuais dependem em alguns pontos da associação ao tenant e precisam de endurecimento por papel e usuário ativo.
- Esta spec deve ser concluída e validada antes da Spec 031.
- Esta publicação cria somente a especificação local. Nenhum código, banco, migration, dado, commit, push ou deploy é alterado.
