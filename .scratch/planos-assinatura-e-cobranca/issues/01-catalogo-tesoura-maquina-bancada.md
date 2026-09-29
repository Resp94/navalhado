# 01: Catálogo Tesoura, Máquina e Bancada

Parte da spec 052 (Planos, assinatura e cobrança recorrente).

**What to build:** quem se cadastra no Navalhado vê e escolhe entre os planos novos, e a barbearia fica ligada ao plano escolhido.

| Plano | Profissionais | Preço mensal | Antes era |
|---|---|---|---|
| Tesoura | 1 | R$ 59,90 | Bronze |
| Máquina | 5 | R$ 89,90 | Prata |
| Bancada | 10 | R$ 159,90 | Ouro |

- Os planos são renomeados mantendo os UUIDs. As assinaturas existentes continuam apontando para o mesmo plano.
- A coluna de recursos do plano (`features`) sai: nenhum plano tem recurso a menos.
- A tela de cadastro deixa de ter os planos fixos no código e passa a ler o catálogo do banco, com o plano do meio da lista por preço (hoje o Máquina) pré-selecionado.
- O cadastro passa a ligar o plano pelo identificador, e não mais pelo nome em minúsculas. Renomear um plano no futuro não quebra o cadastro.
- O Admin > Tenants e o onboarding mostram os nomes e preços novos.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Migration renomeia os três planos pelo UUID, com os preços e limites novos; nenhuma assinatura muda de plano
- [x] Antes de remover `features`, conferido que nenhuma função, view ou tela a lê; a coluna é removida
- [x] O cadastro lê o catálogo do banco, mostra nome, preço e limite de cada plano e vem com o plano do meio (hoje o Máquina) marcado
- [x] O cadastro grava a escolha pelo id do plano; a função que cria o tenant no cadastro liga o plano pelo id
- [x] Teste de componente do cadastro: mostra os três planos vindos do banco e envia o id do plano escolhido
- [x] Os testes atuais do cadastro e do onboarding continuam passando
- [x] Conferido no DEV por consulta, antes e depois: os três planos renomeados e as assinaturas no mesmo UUID
- [x] `npm run lint`, `npm test` e `npm run build` passam

## Resultado (2026-09-29)

- **Migration** `052_ticket01_catalogo_tesoura_maquina_bancada` aplicada no DEV (`selvxobcjbkligxighlp`), versão `20260929165933`. Renomeia os três planos pelo UUID, remove `features` e troca `handle_new_user` para ligar o plano por `tenant_signup.plan_id`. Um id ausente, mal formado, inexistente ou o nome antigo do plano em `plan_id` cai em `INVALID_PLAN` (não em erro de conversão de uuid).
- **Compatibilidade com o front antigo.** O campo `tenant_signup.plan` (bronze, prata, ouro) continua aceito e aponta para Tesoura, Máquina e Bancada, porque os UUIDs não mudaram. Assim a ordem de promoção não importa: migration antes ou depois do front, o cadastro não cai. **Remover essa compatibilidade** quando o front novo estiver em todos os ambientes.
- **Guarda da migration.** Os três `UPDATE` rodam num bloco que conta as linhas atualizadas e levanta `CATALOGO_DE_PLANOS_INESPERADO` se não forem 3, desfazendo a migration inteira (inclusive a remoção de `features`). Verificado no DEV nos dois caminhos: com os UUIDs certos passa, com um UUID errado levanta `2 de 3 planos encontrados`.
- **Conferido no DEV por consulta.** Antes: Prata 2 assinaturas, Ouro 1. Depois: Máquina 2, Bancada 1, nos mesmos UUIDs. A view do Admin > Tenants já mostra Bancada R$ 159,90 e Máquina R$ 89,90. Nenhuma função, view ou tela lia `features`. Nenhuma sobra de teste no DEV.
- **pgTAP 63** (novo, 12 asserções, 12/12): catálogo com os três planos nos UUIDs antigos (marcado como o contrato de preços deste ticket), `features` removida, leitura anônima do catálogo, cadastro ligando o plano pelo id, quatro formas de plano inválido recusadas, o campo antigo `plan` aceito e recusado quando o nome nunca existiu, nenhum tenant criado no erro e uma única assinatura por tenant. **pgTAP 60** atualizado de `plan: 'prata'` para `plan_id`, 4/4.
- **Módulo `planos`** (Repository, adaptadores Supabase e em memória, hook `usePlanos`, 7 testes): lê o catálogo ordenado por preço e recusa catálogo vazio. O plano padrão do cadastro é o do meio da lista, escolhido pela posição e não pelo nome.
- **Cadastro** usa o módulo, mostra preço e limite reais, envia `plan_id`, avisa quando o catálogo não carrega e não envia o cadastro nesse caso, nem por submit fora do botão. Antes a tela mostrava Bronze R$ 49,90 (3), Prata R$ 89,90 (8) e Ouro R$ 149,90 (ilimitado), valores que nem batiam com o banco.
- **Onboarding:** enquanto a assinatura não chega (ou se a leitura falha), não mostra plano nem cota e não bloqueia o cadastro de profissionais. Antes assumia Bronze com limite 3. Cobre a mesma cota que o ticket 02 vai trazer para a regra do banco.
- **Testes:** cadastro 9, módulo `planos` 7, onboarding 4 novos. Verificação final no fim desta seção.

### Fora do combinado

- **Onboarding** (`OnboardingWizard`, `StepSegmentation`, `StepProfessionals`): a mudança acima toca os três, porque o nome e o limite de reserva do Bronze deixaram de existir.
- **Documentação:** `features` removida de `docs/modelagem_banco.md` e o plano das credenciais de teste atualizado para Máquina.
- **Ledger do DEV.** A versão `20260929165933` foi aplicada antes do guarda e da compatibilidade entrarem no arquivo. A função com a compatibilidade foi reaplicada no DEV por SQL, então o DEV tem o mesmo esquema do arquivo, mas o guarda só existe no arquivo. Em prod, o arquivo inteiro é aplicado.

### Antes de promover para prod

- Conferir por consulta que prod tem os três UUIDs (`...c11`, `...c22`, `...c33`). O guarda da migration também barra a diferença.
- No DEV, o cadastro em `dev.navalhado.com.br` continua funcionando com o front antigo (compatibilidade) e com o novo.
