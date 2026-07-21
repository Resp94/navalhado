# Configuracao local aponta para o ambiente dev

O arquivo `.env` local do Navalhado deve apontar por padrao para o Supabase dev, mantendo producao fora do fluxo local cotidiano. Essa escolha reduz o risco de testes, seeds, Edge Functions ou operacoes manuais afetarem dados reais enquanto ainda permite que o ambiente dev reproduza a arquitetura completa.
