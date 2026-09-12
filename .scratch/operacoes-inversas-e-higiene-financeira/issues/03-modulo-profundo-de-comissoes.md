# 03 — Módulo profundo de comissões

**What to build:** As operações de comissão passam a ter um módulo profundo próprio, no mesmo nível de `CaixaRepository` e `ComandaRepository`, cobrindo registro de Quitação de Comissão e consulta de saldo do profissional. O comportamento visível ao gerente não muda: este ticket apenas move a chamada direta de tela para trás de um contrato, para que as mudanças seguintes tenham onde ser testadas.

**Blocked by:** None (can start immediately).

**Status:** done — modulo src/modules/comissoes criado, QuitacaoComissaoModal migrado, 13 testes verdes, tsc limpo

- [x] Definir o contrato público do módulo cobrindo registro de quitação e consulta de saldo, seguindo o padrão de validação de entrada já usado nos módulos de Caixa e Comanda.
- [x] Definir a porta de adaptador correspondente e implementar o adaptador Supabase sobre as funções remotas vigentes.
- [x] Substituir a chamada direta à função remota feita hoje pelo componente de quitação por uma chamada ao módulo.
- [x] Preservar exatamente o formato de entrada e de retorno que a tela atual já consome.
- [x] Traduzir erro de domínio vindo do banco no mesmo padrão de erro dos demais módulos.
- [x] Cobrir o contrato com testes de adaptador dublê: campos obrigatórios, faixas inválidas e repasse fiel ao adaptador.
- [x] Manter verdes as suítes atuais do Financeiro e do modal de quitação.
