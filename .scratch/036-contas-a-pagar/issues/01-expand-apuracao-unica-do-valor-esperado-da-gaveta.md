# 01: Expand — apuração única do valor esperado da gaveta no servidor

**What to build:** nenhuma mudança de número visível para o gestor. O valor esperado da gaveta de
uma Sessão de Caixa passa a ser calculado em **um único lugar** no banco, e as três funções que
hoje copiam a fórmula passam a consumir esse ponto único, devolvendo exatamente o que devolvem
hoje. Make the change easy, then make the easy change.

Motivo: cada uma das três funções filtra os tipos de movimento pelo nome. A spec 034 já pagou esse
preço ao incluir o vale, editando as três sob risco de erro silencioso de saldo, e a Baixa pela
gaveta (ticket 15) seria o terceiro tipo a repetir o defeito. Com o sentido do movimento (entrada
ou saída) materializado na própria linha, a apuração soma por sentido e nunca mais precisa
conhecer tipo pelo nome.

Este ticket também cria o contrato de leitura que a prévia da tela vai consumir no ticket 02, e
prova que ele devolve o mesmo número que o fechamento persiste. É a primeira migração do
expand-contract da Entrega 1; a revogação da inserção direta vem só no ticket 04.

O contrato do ticket é **saída idêntica**, verificável pelas suítes que já cobrem a gaveta.

Spec: `specs/036-contas-a-pagar/spec.md`, seção "Entrega 1 — Apuração única do valor esperado da
gaveta".

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [x] Existe uma função privada única que calcula o valor esperado de uma Sessão de Caixa: fundo
      de troco inicial, mais dinheiro recebido de Comanda na sessão, mais entradas de movimento,
      menos saídas de movimento, considerando só movimentos não estornados.
- [x] A função devolve o valor esperado e o detalhamento agrupado por tipo de movimento tirados da
      mesma agregação, de modo que total e parcelas nunca divergem.
- [x] A função não autoriza nada (pressupõe papel, tenant e lock validados por quem chama), vive
      no schema privado e tem execução revogada de público, anônimo e autenticado.
- [x] A tabela de movimentos de caixa ganha coluna gerada, armazenada e obrigatória de sentido
      (entrada ou saída), derivada do tipo por expressão **sem ramo padrão**: um tipo novo aceito
      pela restrição de tipo sem sentido declarado falha na primeira inserção.
- [x] A regra de estorno vale igual para todos os tipos, inclusive suprimento e sangria, sem
      alterar nenhum resultado atual.
- [x] O Fechamento de Caixa, a Quitação de Comissão em dinheiro e o vale em dinheiro passam a
      obter o valor da função privada. As três funções são substituídas sem mudar assinatura (sem
      derrubar e recriar), com as mesmas mensagens de erro e as mesmas chaves de retorno.
- [x] A versão de cálculo gravada no fechamento permanece a atual.
- [x] Contrato de leitura novo devolve, para uma sessão aberta, o valor esperado e o detalhamento
      por tipo, revalidando papel e tenant (gerente do próprio tenant; proprietário como
      administrador do SaaS, no padrão das RPCs financeiras existentes).
- [x] Regressão na suíte pgTAP `07_fechar_caixa_atomicamente`, sem arquivo novo:
  - [x] sessão com todos os tipos de movimento, incluindo repasse e vale estornados, fecha com o
        valor esperado calculado à mão;
  - [x] o contrato de leitura da prévia devolve exatamente o valor que o fechamento persiste em
        seguida;
  - [x] todo tipo aceito pela restrição de tipo recebe sentido, provado enumerando os tipos
        aceitos — é esta asserção que faz a suíte falhar quando um tipo futuro chegar sem
        aritmética declarada.
- [x] Regressão na suíte pgTAP `25_validar_saldo_gaveta_quitacao_comissao`: o disponível visto
      pela quitação e pelo vale continua descontando repasses e vales.
- [x] As suítes pgTAP `19_quitacao_comissao_gaveta_caixa`, `21_estorno_quitacao_comissao`,
      `26_conta_do_profissional_gorjeta` e `27_abate_vale_na_quitacao_comissao` passam **sem
      alteração** — são a prova de que as funções reescritas devolvem o mesmo resultado.
- [x] Obrigações de comissão, Quitação de Comissão, Conta do Profissional e seus contratos não
      mudam de semântica.
- [ ] `npm run test:db` verde.
