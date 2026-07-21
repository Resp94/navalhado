# Branch dev permanente para ambiente de integracao

O Navalhado usa uma branch `dev` permanente como ponteiro estavel do ambiente de desenvolvimento completo e isolado. Essa decisao separa validacao e integracao de mudancas da branch `main`, permitindo que variaveis, deploys, Edge Functions e banco de desenvolvimento evoluam sem apontar fluxos de teste para producao.
