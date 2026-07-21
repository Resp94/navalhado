# Evolution dev separada da producao

Status: proposta futura

O ambiente dev do Navalhado usa uma stack separada da Evolution API na VPS, em vez de compartilhar a Evolution de producao com nomes ou chaves diferentes. A separacao evita que testes de pareamento, desconexao, webhooks e automacoes de WhatsApp afetem instancias reais ou dependam da chave global de producao.
