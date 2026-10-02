// Textos da Exportação de Dados (spec 052, ticket 14), ditos nas duas telas que a oferecem: a tela Assinatura e a tela de bloqueio.

/** O que o Gerente baixa. */
export const DESCRICAO_DA_EXPORTACAO =
  'Os dados da barbearia são seus: baixe os clientes, os agendamentos e as comandas em planilhas CSV, uma para cada, quando quiser.';

/**
 * Depois dos três downloads. O navegador pode barrar o 2º e o 3º sem avisar a página (ele pergunta uma vez se o site pode baixar
 * vários arquivos), então a tela diz o que foi baixado e o que fazer se faltar algum.
 */
export const AVISO_DE_ARQUIVOS_BAIXADOS =
  'Baixamos os clientes, os agendamentos e as comandas. Se algum arquivo não aparecer, libere o download de vários arquivos neste site e exporte de novo.';
