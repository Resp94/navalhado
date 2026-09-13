# 05: Validação de CPF e CNPJ alfanumérico

**What to build:** nenhum comportamento novo é oferecido ao gestor neste ticket. O que ele entrega é
a garantia de que o documento do Fornecedor (ticket 06) será conferível com nota e comprovante:
o sistema passa a reconhecer CPF e CNPJ válidos, **incluindo o CNPJ alfanumérico** que a Receita
Federal emite desde julho de 2026. Validar só o formato numérico recusaria fornecedores reais
abertos há dois meses.

Não existe validação de CPF nem de CNPJ em lugar nenhum do código — o CPF de cliente é texto livre —,
então não há o que reusar. A validação nasce em dois lugares com papéis distintos: **no banco**, como
autoridade que nenhuma escrita futura contorna; **no módulo do Plano de Contas**, como função pura
de domínio para retorno imediato no formulário. As duas implementações do mesmo algoritmo são
cobertas pelo **mesmo conjunto de vetores de teste** nas duas suítes, e é isso que impede que
divirjam.

Isolado de propósito: o algoritmo chega verde e com vetores compartilhados antes de o cadastro de
Fornecedores depender dele.

Spec: `specs/035-plano-de-contas-categorias-e-fornecedores/spec.md`, seção "Entrega 2 —
Fornecedores", item "Documento".

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Função privada e imutável no banco que valida documento normalizado, apta a ser usada em
      restrição de verificação de coluna, sem execução concedida a anônimo.
- [ ] Função pura de domínio no módulo do Plano de Contas com o mesmo algoritmo.
- [ ] Normalização da entrada com máscara: pontos, barras, hífens e espaços descartados, letras
      convertidas para maiúsculas. O documento é gravado sem máscara.
- [ ] Onze caracteres são CPF: somente dígitos, com os dois dígitos verificadores do algoritmo
      oficial.
- [ ] Catorze caracteres são CNPJ: doze posições de dígito ou letra maiúscula seguidas de dois dígitos
      verificadores numéricos, calculados com o valor de cada caractere igual ao seu código ASCII
      menos 48 e os mesmos pesos do CNPJ numérico. Um CNPJ só com dígitos se comporta exatamente como
      o antigo.
- [ ] Qualquer outro comprimento é inválido. Sequência de um único caractere repetido é inválida,
      embora passe no cálculo.
- [ ] O tipo (CPF ou CNPJ) é derivado do comprimento e não é armazenado.
- [ ] Função pura de formatação para exibição, com a máscara de CPF ou de CNPJ conforme o
      comprimento.
- [ ] Conjunto único de vetores, idêntico nas duas suítes: CPF válido, CNPJ numérico válido, CNPJ
      alfanumérico válido, dígito verificador errado, sequência repetida, comprimento inválido e
      letra em CPF.
- [ ] Vetores cobertos no arquivo pgTAP do Plano de Contas (criando-o, se o ticket 03 ainda não o
      tiver criado) e no teste da função pura de domínio.
- [ ] Nenhuma tabela é criada ou alterada neste ticket.
- [ ] `npm run test` e `npm run test:db` verdes.
