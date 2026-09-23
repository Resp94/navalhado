# 18: Auditoria dos módulos sem adaptador em memória

**What to build:** a observação da Lista de Espera se perdia a caminho do banco com a suíte verde. A causa de fundo foi o módulo não ter adaptador em memória próprio: o teste usava um dublê declarado dentro do arquivo, mais generoso que a tabela, que guardava o campo que o banco descartava. A spec 043 corrigiu isso na Lista de Espera e registrou que valia conferir os outros módulos.

Numa contagem preliminar feita em 2026-09-22, só 5 dos 16 módulos têm adaptador em memória na pasta de adaptadores. A contagem olhou só o nome do arquivo e pode estar errada nos dois sentidos.

Depois deste ticket, sabe-se quais módulos correm o mesmo risco, e cada um que correr vira ticket próprio.

**Onde foi achado:** notas finais da spec 043.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Para cada módulo, fica registrado se ele tem adaptador em memória, qualquer que seja o nome ou o lugar do arquivo
- [x] Para cada módulo sem adaptador em memória, fica registrado como o teste do repositório é montado hoje: dublê dentro do arquivo, simulação do cliente do banco, ou nenhum teste de repositório
- [x] Para cada dublê encontrado, fica registrado se ele guarda algum campo que a tabela real não tem, conferido contra a estrutura do banco no ambiente de desenvolvimento; é esse o padrão que escondeu o defeito da Lista de Espera
- [x] Todo campo que o tipo de domínio declara e a tabela não tem é listado, como era o carimbo de atualização da Lista de Espera
- [x] Todo achado com risco de perda silenciosa de dado vira ticket próprio, com o módulo como escopo
- [x] Este ticket não cria adaptador nem altera código de produção ou de teste; ele só levanta
- [x] O resultado fica registrado neste ticket, inclusive a correção da contagem preliminar

**Resultado (2026-09-22):**

- **Contagem preliminar confirmada, não corrigida**: são de fato 16 módulos em `src/modules/`, e 5 têm adaptador em memória real: `agenda`, `canal-cliente`, `clientes`, `espera` (já corrigido pela spec 043) e `plano-contas`.
- **Os 11 módulos restantes, por como o teste do repositório é montado hoje:**
  - **Interface mockada por `vi.fn()`** (sem nenhum "banco de mentira" acumulando estado — cada teste devolve um literal próprio): `bloqueios`, `caixa`, `comandas`, `comissoes`, `contaProfissional`, `contas-pagar`, `fluxo-caixa`, `produtos`, `relatorios`. `contas-pagar` já documenta essa decisão em comentário no próprio `types.ts` (regras vivem no banco, sem fake).
  - **Simulação direta do cliente Supabase** (`mockSupabase.from(...)`), não do adaptador: `profissionais` — não tem pasta `adapters/` nem `Repository`, só `servicesAdapter.ts` testado contra um mock do client.
  - **Nenhum teste de repositório**: `whatsapp` — não tem adaptador nem repositório; só `templates.test.ts`, que testa funções puras de template, sem tocar banco.
- **Nenhum dublê com campo a mais encontrado.** O padrão que escondeu o defeito da Lista de Espera é um "banco de mentira" que guarda e devolve um campo que a tabela real não tem — nenhum dos 11 módulos acima tem esse tipo de dublê: os 9 com interface mockada não têm datastore nenhum para acumular um campo fantasma (cada `vi.fn()` só devolve o que o teste manda, não simula uma tabela); `profissionais` mocka o client, não uma tabela; `whatsapp` não tem teste de banco.
- **Todo campo "a mais" nos tipos de domínio conferido contra o schema real (projeto dev, `selvxobcjbkligxighlp`) e explicado, nenhum é o padrão da Lista de Espera:**
  - `caixa`: `opened_by_name`, `financial_state`, `total_revenue`, `adjustment_count` — join/cálculo de leitura, não coluna própria.
  - `comandas`: `comanda_number` (índice calculado no cliente), `ComandaItem.name` e `ComandaEnriched.*_name` — enriquecimento de leitura via join.
  - `produtos`: `quantity_change`, `new_stock_level`, `notes` em `ProductMovement` — calculados em `SupabaseProdutoAdapter.buscarMovimentacoes` a partir de colunas reais (`quantity`, `movement_type`, `reason`), nunca gravados com esses nomes.
  - `profissionais`: `service_name`, `service_category`, `base_duration_minutes`, `base_price` — vêm de join com `services`, não são coluna de `professional_services`.
  - `contaProfissional`: campos de `ProfessionalAccountEntry` batem exatamente com `professional_account_entries`, sem sobra.
  - `comissoes`, `contas-pagar`, `fluxo-caixa`, `relatorios`: só RPC, sem leitura direta de tabela — não há linha de tabela para o tipo de domínio divergir.
- **Nenhum ticket de acompanhamento aberto**: nenhum módulo apresentou o risco de perda silenciosa de dado (campo que o domínio ou um dublê guarda e a tabela real não tem). A causa que produziu o defeito da Lista de Espera — um dublê "mais generoso" que a tabela real — não se repete em nenhum dos outros 15 módulos.
- **Ressalva registrada, fora do escopo deste ticket**: os 4 módulos só-RPC (`comissoes`, `contas-pagar`, `fluxo-caixa`, `relatorios`) não têm linha de tabela pra comparar — uma auditoria de divergência entre o tipo de domínio e o contrato de retorno da função Postgres seria outro tipo de verificação, não coberta aqui (esta auditoria é de coluna de tabela, não de contrato de função).
- **Nenhum código de produção ou de teste alterado**: `git status` confirma que só este arquivo de ticket mudou nesta branch.
- Investigação feita por agente dedicado, com leitura de cada pasta `adapters/`, grep em cada arquivo `__tests__` por padrões de dublê com estado (`class Fake`, `new Map()`, array/objeto local acumulando registro), e conferência campo a campo contra `list_tables`/`execute_sql` do servidor MCP do Supabase no ambiente de desenvolvimento.
