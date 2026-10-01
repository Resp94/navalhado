# 14: Exportar dados

Parte da spec 052 (Planos, assinatura e cobrança recorrente).

**What to build:** o Gerente baixa os dados da barbearia a qualquer momento, inclusive bloqueado. Os dados nunca ficam presos ao Navalhado.

- O botão "Exportar dados" aparece na tela de bloqueio do Gerente e na tela Assinatura.
- O arquivo reúne, em CSV, os clientes, os agendamentos e as comandas do tenant, lidos com as permissões do próprio Gerente.
- A leitura continua permitida com a barbearia bloqueada, porque o bloqueio do painel é só no front.
- Só o Gerente exporta. O Barbeiro não vê o botão.

**Blocked by:** 03 (Período de teste, Estado de Acesso e bloqueio do painel), 06 (Tela Assinatura e histórico de cobranças, 05b)

**Status:** in-progress

- [x] Teste do módulo: gera os três CSV com os dados do próprio tenant, cabeçalho e acentos corretos
- [x] Teste do front: o botão aparece para o Gerente na tela de bloqueio e na tela Assinatura, e não aparece para o Barbeiro
- [x] Conferido no DEV: um tenant bloqueado exporta os três arquivos (ver "Conferido no DEV": o bloqueio foi simulado no navegador, e a barbearia de teste não tem dados, então os arquivos saíram só com o cabeçalho)
- [ ] `npm run lint`, `npm test` e `npm run build` passam

## Resultado (2026-10-01)

**Módulo `src/modules/exportacao/`**: `ExportacaoRepository.gerarArquivos(tenantId, fuso)` monta os três CSV; `SupabaseExportacaoAdapter` lê as oito tabelas com a sessão do Gerente; `InMemoryExportacaoAdapter` serve os testes; `useExportarDados(tenantId, fuso)` lê e baixa os três arquivos (uma pausa de 300 ms entre os downloads, porque o navegador barra os seguintes em silêncio quando vêm colados). O formato é o dos relatórios (`gerarCsv` e `baixarCsv` de `modules/relatorios/csv.ts`, reaproveitados): `;`, BOM do UTF-8, CRLF e o valor que começaria uma fórmula protegido com apóstrofo.
- **clientes_AAAA-MM-DD.csv** (12 colunas): ID, Nome, Telefone, E-mail, CPF, Data de nascimento, Etiquetas, Canal de aquisição, Origem do cadastro, Cadastro completo, Observações, Cadastrado em. Em ordem alfabética.
- **agendamentos_AAAA-MM-DD.csv** (17 colunas): ID, Data, Início, Fim, Cliente, Telefone do cliente, Profissional, Serviço, Situação, Pagamento, Origem, Encaixe, Veio da lista de espera, Cancelado por, Motivo do cancelamento, Observações, Criado em. Do mais antigo ao mais novo; profissional, serviço e cliente pelo nome (inclusive o excluído: a leitura não filtra `deleted_at`).
- **comandas_AAAA-MM-DD.csv** (14 colunas): Código (`CMD-` e as cinco primeiras letras do ID, como a tela das comandas), ID, Abertura, Fechamento, Situação, Cliente, ID do agendamento, Itens, Desconto, Desconto em %, Gorjeta, Total, Pagamentos, Observações. Uma linha por comanda, com os itens (`1x Corte (40,00) | 1x Pomada (30,00)`) e os pagamentos (`PIX 50,00 | Dinheiro em espécie 20,00 (troco 5,00)`) resumidos em uma célula cada. Valores em reais com vírgula, sem o símbolo, para a planilha somar.
- Datas e horas no fuso da barbearia (o dia do nome do arquivo também). O token de acesso do cliente (`token_acesso`) não vai: nenhuma leitura usa `*`.
- A leitura anda em páginas de 1000 linhas (limite do PostgREST), em ordem de `id`, até uma página voltar curta; o erro do banco sobe em vez de virar um arquivo incompleto.

**Tela:** `BotaoExportarDados` ("Exportar dados", com o erro em `role="alert"` e o botão desligado enquanto exporta). Aparece na `TelaDeBloqueio` só para o Gerente, em qualquer motivo de bloqueio e mesmo com o pagamento sendo confirmado (o `GerenteLayout` passa `tenantId` e `timezone`; o Barbeiro nunca vê, nem com a barbearia identificada) e na seção Assinatura de Configurações, em qualquer situação da assinatura e até quando ela não carrega, num bloco "Seus dados" que diz o que o Gerente baixa. Vitest: módulo 22 testes (repositório, adaptador, hook), botão 5, tela de bloqueio +6, seção Assinatura +9, layout +1.

**Banco:** nada muda. O pgTAP 76 (11 asserções, 11 ok no DEV) prova a premissa da spec: o Gerente de uma barbearia bloqueada (Estado de Acesso `blocked`, conferido na própria suíte) lê clientes, agendamentos, comandas, itens, pagamentos, profissionais, serviços e produtos da barbearia dele, nem mais nem menos, e nada de outra; o Gerente sem barbearia (`tenant_id` nulo) não lê nada. Nenhuma das 29 políticas de leitura dessas oito tabelas olha a assinatura.

### Decisões
- **Três arquivos, um por vez, e não um ZIP.** A spec fala em "o arquivo" e o ticket em "os três arquivos". Sem biblioteca de ZIP no projeto, três CSV evitam código novo e dependência; o custo é o navegador perguntar uma vez se o site pode baixar vários arquivos. Um ZIP (escrito à mão, sem compressão) caberia aqui se isso incomodar.
- **Leitura pelo navegador, com a sessão do Gerente, e não por função do servidor**, como a spec manda: a RLS por tenant é quem limita, e o `eq('tenant_id')` só repete de quem são os dados.
- **Nomes ao lado do ID.** O arquivo precisa ser legível em uma planilha e também cruzável entre os três (o ID do agendamento está na comanda).
- **Comanda em uma linha**, com itens e pagamentos resumidos, para manter os três arquivos da spec; itens e pagamentos como arquivos próprios dariam o dado sem perda e ficam como evolução.
- **`;` e BOM**, o formato brasileiro dos relatórios (spec 038), em vez da vírgula do CSV de outros países.

### Conferido no DEV (2026-10-01)
Na tela de verdade (`localhost:5173`, banco do DEV, sessão do Gerente de teste da "Barbearia MP Teste"): na seção Assinatura e na tela de bloqueio, o clique baixou `clientes_2026-10-01.csv`, `agendamentos_2026-10-01.csv` e `comandas_2026-10-01.csv`, cada um com o BOM (`ef bb bf`), 12, 17 e 14 colunas e sem erro, com o botão voltando ao normal. Duas ressalvas: (1) a tela de bloqueio foi forçada só no navegador (a resposta do Estado de Acesso foi trocada por "bloqueado" no `fetch` da página, sem gravar nada no banco), porque não bloqueei a barbearia de teste; as leituras de dados foram as reais; (2) essa barbearia não tem clientes, agendamentos nem comandas, então os arquivos saíram só com o cabeçalho. O conteúdo das linhas está coberto pelos testes do módulo e pelo pgTAP 76.

### Limitações
- **Vários downloads seguidos:** o navegador pode perguntar uma vez se o site pode baixar vários arquivos; se o Gerente negar, só o primeiro sai.
- **Tudo em memória:** a leitura carrega as oito tabelas inteiras antes de montar os arquivos. Para uma barbearia com centenas de milhares de agendamentos isso pesa (e leva uma ida ao banco por 1000 linhas); com o porte de barbearia que o produto atende, não é o caso.
- **Itens e pagamentos da comanda resumidos:** quem precisar do dado por linha de item não o tem em coluna própria.
- **Barbearia bloqueada com o JWT vencido:** a leitura falha como qualquer outra e a mensagem padrão aparece; o Gerente entra de novo.
