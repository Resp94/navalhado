# 04: Gráfico de evolução e exportação CSV

**What to build:** na página Faturamento, o gestor vê a evolução do faturamento num gráfico e pode
exportar a tabela em CSV para abrir no Excel ou mandar ao contador. A função de CSV nasce aqui para
ser reusada por todas as outras páginas do módulo.

O gráfico é SVG feito à mão, sem biblioteca nova, pelo precedente do painel administrativo e do
Fluxo de Caixa Projetado. Não há ida nova à rede: tudo sai dos dados já carregados. O CSV exporta
exatamente a tabela equivalente ao que a página mostra, no formato brasileiro.

Spec: `specs/038-modulo-de-relatorios/spec.md`, seções "Módulo" (CSV), "Telas" e histórias 14, 76,
77 e 81.

**Blocked by:** 01 — Esqueleto do módulo e Faturamento por período.

**Status:** ready-for-agent

- [ ] Função pura de CSV: separador ponto e vírgula, vírgula decimal, datas `dd/mm/aaaa`, BOM UTF-8
      para o Excel, escape de aspas e de campos com ponto e vírgula ou quebra de linha, cabeçalho em
      pt-BR.
- [ ] Botão "Exportar CSV" reutilizável que recebe colunas e linhas já carregadas e baixa o arquivo
      com nome que inclui o relatório e as datas do período.
- [ ] Página Faturamento exporta a tabela por agrupamento (e as tabelas de recebido e ticket, se já
      existirem).
- [ ] Gráfico de evolução do faturamento líquido por agrupamento, com serviços e produtos
      distinguíveis sem depender só de cor, título descritivo no SVG e tabela como equivalente
      acessível.
- [ ] Em granularidade diária com muitos agrupamentos, o gráfico rola na horizontal dentro do próprio
      contêiner, nunca a página.
- [ ] Nenhuma dependência nova no projeto.
- [ ] Testes da função de CSV (separador, vírgula decimal, datas, BOM, aspas, ponto e vírgula dentro
      do campo) e caso novo no teste da página cobrindo a presença do botão de exportar.
- [ ] `npm run test` verde.
