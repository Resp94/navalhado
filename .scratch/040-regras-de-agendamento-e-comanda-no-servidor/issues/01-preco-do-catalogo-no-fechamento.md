# 01: Preço do catálogo no fechamento de Comanda

**What to build:** ao fechar uma Comanda, o valor de cada Item de Comanda passa a ser decidido pelo banco a partir do catálogo, não pela tela. Produto e serviço de preço fixo (`fixed`) são cobrados pelo preço cadastrado. Serviço com Modalidade de Preço `starting_at` aceita o valor informado pelo gestor, desde que não fique abaixo do preço cadastrado. Todo abatimento passa a ser feito só pelo desconto da Comanda. O gestor vê uma mensagem clara quando o valor de um serviço "a partir de" fica abaixo do mínimo.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] A RPC de liquidação da Comanda ignora o preço enviado pela tela para produto e para serviço `fixed` e grava o preço do catálogo
- [x] Serviço `starting_at` com valor abaixo do preço cadastrado é recusado com código de erro próprio e mensagem em português
- [x] Serviço `starting_at` com valor igual ou acima do mínimo é aceito pelo valor informado
- [x] Totais, rateio de desconto, snapshot e comissão continuam calculados sobre o preço efetivamente gravado
- [x] O modal de fechamento mostra a recusa do valor mínimo sem perder o que foi preenchido
- [x] pgTAP: produto e serviço `fixed` com preço adulterado gravam o preço do catálogo; `starting_at` abaixo do mínimo recusado; acima aceito
- [x] `npm run lint`, `npm test` e `npm run build` passam
