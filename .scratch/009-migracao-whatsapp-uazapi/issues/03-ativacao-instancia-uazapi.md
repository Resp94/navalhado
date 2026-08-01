# 03 — Ativar uma instância pela Uazapi

**What to build:** Permitir que o Gerente ative a Integração do WhatsApp pelo fluxo atual, enquanto o backend cria a instância real na Uazapi, protege o token retornado, configura seu webhook individual e persiste a integração. A operação deve terminar completamente ou compensar qualquer etapa parcial.

**Blocked by:** 01 — Extrair o contrato neutro do provedor; 02 — Expandir a persistência da Instância WhatsApp.

**Status:** ready-for-agent

- [ ] Somente o Gerente autenticado pode ativar a integração para o próprio tenant.
- [ ] O frontend solicita a ativação ao backend sem inserir instância ou gerar chave.
- [ ] O backend rejeita a ativação quando o tenant já possui uma Instância WhatsApp.
- [ ] A Uazapi recebe uma criação administrativa com nome e metadados correlacionáveis ao tenant e ambiente.
- [ ] ID e token retornados são armazenados sem chegar ao navegador ou aos logs.
- [ ] Um webhook individual é configurado somente para conexão e novas mensagens.
- [ ] O webhook exclui mensagens originadas pela API, enviadas pelo próprio número e pertencentes a grupos.
- [ ] A integração aparece como desconectada e pronta para pareamento após sucesso.
- [ ] Falha depois da criação remota executa compensação e não deixa instância órfã ou registro fantasma.
- [ ] Ativações concorrentes produzem no máximo uma instância.
- [ ] Erros são apresentados ao Gerente de forma clara e sem dados sensíveis.
- [ ] Testes do handler e da interface cobrem sucesso, autorização, conflito, compensação e sigilo do token.

