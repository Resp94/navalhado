// Normalização de nome compartilhada pelo Plano de Contas (spec 035): pontas
// aparadas, espaços internos repetidos colapsados em um só. A mesma regra
// vale para Categoria de Despesa (ticket 04) e para Fornecedor (ticket 06,
// "normalizado como o nome de categoria" -- spec, seção "Entrega 2 --
// Fornecedores"). A RPC normaliza de novo no banco, como autoridade sob
// concorrência; aqui serve para validar e para a experiência imediata na
// tela.
export function normalizarNome(entrada: string): string {
  return (entrada || '').trim().replace(/\s+/g, ' ');
}
