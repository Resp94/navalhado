# Navalhado

Glossario de dominio do Navalhado, usado para manter uma linguagem comum nas decisoes de produto, dados e operacao.

## Language

**Ambiente Dev Completo e Isolado**:
Um ambiente de desenvolvimento separado da producao, com branch, variaveis de ambiente, banco Supabase, Edge Functions, secrets, triggers e rotinas proprias. Nenhum fluxo do ambiente dev deve chamar recursos de producao.
_Avoid_: Banco de testes, replica parcial, ambiente compartilhado

**Configuracao Local Padrao**:
Conjunto de variaveis carregado no desenvolvimento local. No Navalhado, deve apontar para o ambiente dev, nao para producao.
_Avoid_: Env de producao local, configuracao mista

**URL Publica Dev**:
Endereco publico do frontend do ambiente dev usado em links enviados por WhatsApp e testes reais. No Navalhado, esta URL e `https://dev.navalhado.com.br`.
_Avoid_: localhost em mensagens, URL de producao em teste

**Evolution Dev**:
Stack separada da Evolution API usada pelo ambiente dev para criar, parear e testar instancias de WhatsApp sem tocar instancias de producao.
_Avoid_: Evolution compartilhada, instancia dev em producao
