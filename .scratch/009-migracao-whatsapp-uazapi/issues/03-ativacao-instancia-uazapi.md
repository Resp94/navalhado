# 03 — Ativar uma instância pela Uazapi

**What to build:** Permitir que o Gerente ative a Integração do WhatsApp pelo fluxo atual, enquanto o backend cria a instância real na Uazapi, protege o token retornado, configura seu webhook individual e persiste a integração. A operação deve terminar completamente ou compensar qualquer etapa parcial.

**Blocked by:** 01 — Extrair o contrato neutro do provedor; 02 — Expandir a persistência da Instância WhatsApp.

**Status:** completed

- [x] Somente o Gerente autenticado pode ativar a integração para o próprio tenant.
- [x] O frontend solicita a ativação ao backend sem inserir instância ou gerar chave.
- [x] O backend rejeita a ativação quando o tenant já possui uma Instância WhatsApp.
- [x] A Uazapi recebe uma criação administrativa com nome e metadados correlacionáveis ao tenant e ambiente.
- [x] ID e token retornados são armazenados sem chegar ao navegador ou aos logs.
- [x] Um webhook individual é configurado somente para conexão e novas mensagens.
- [x] O webhook exclui mensagens originadas pela API, enviadas pelo próprio número e pertencentes a grupos.
- [x] A integração aparece como desconectada e pronta para pareamento após sucesso.
- [x] Falha depois da criação remota executa compensação e não deixa instância órfã ou registro fantasma.
- [x] Ativações concorrentes produzem no máximo uma instância.
- [x] Erros são apresentados ao Gerente de forma clara e sem dados sensíveis.
- [x] Testes do handler e da interface cobrem sucesso, autorização, conflito, compensação e sigilo do token.
