# 03: Minhas Comissões pelo valor gravado

**What to build:** o barbeiro abre Minhas Comissões e vê a comissão do período, o saldo a receber e o extrato de atendimentos pelo valor gravado no fechamento da Comanda, pela mesma fonte da Quitação de Comissão do gestor. Mudar a porcentagem de um serviço no catálogo não altera mais o que ele vê. Vales em aberto e extrato da Conta do Profissional continuam, e a tela segue o padrão mobile atual.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Total, saldo a receber e extrato vêm do ComissaoRepository; a tela não recalcula comissão pela porcentagem do catálogo
- [x] Comissão exibida bate com a Quitação de Comissão do gestor para o mesmo profissional e período
- [x] Filtros hoje, 7 dias e mês no fuso da barbearia
- [x] Vales em aberto e extrato da Conta do Profissional inalterados
- [x] Barbeiro não consegue ver dados de outro profissional nem de outra barbearia; a barbearia vem do vínculo de profissional, e a recusa da RPC vira mensagem clara na tela
- [x] Cadastro de profissional inativo ou arquivado: recusa tratada como mensagem, não como erro genérico
- [x] Layout alinhado ao padrão mobile do gestor
- [x] Testes de tela: comissão pelo valor gravado, mesmo com porcentagem do catálogo alterada
- [x] Verificado no navegador com o barbeiro de teste do DEV
- [x] `npm run lint`, `npm test` e `npm run build` passam
