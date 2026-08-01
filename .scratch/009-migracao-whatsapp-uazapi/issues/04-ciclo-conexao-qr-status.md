# 04 — Parear e administrar o ciclo de conexão

**What to build:** Entregar ao Gerente o ciclo completo da Instância WhatsApp na Uazapi: gerar e renovar QR Code, observar o estado, concluir o pareamento, identificar pausa, retomar a sessão e desconectar completamente quando desejado.

**Blocked by:** 03 — Ativar uma instância pela Uazapi.

**Status:** ready-for-agent

- [ ] “Gerar QR Code” inicia a conexão usando exclusivamente o token da instância no backend.
- [ ] O QR Code retornado pela conexão aparece imediatamente na interface.
- [ ] Enquanto estiver pareando, consultas temporárias renovam QR Code e estado sem continuar indefinidamente.
- [ ] Webhook e Realtime continuam atualizando o estado observado.
- [ ] A consulta temporária termina ao conectar, desconectar, pausar, sair da tela ou atingir o limite de espera.
- [ ] A interface apresenta conectado, pareando, desconectado e pausado com textos neutros de WhatsApp.
- [ ] Uma instância pausada pode ser retomada sem novo QR Code.
- [ ] “Desconectar” encerra a sessão e exige novo QR Code na próxima conexão.
- [ ] Desconectar preserva a instância e as preferências de mensagens.
- [ ] QR Code é limpo quando deixa de ser válido.
- [ ] Falhas encerram o carregamento e permitem nova tentativa manual.
- [ ] Testes cobrem resposta imediata, atualização temporária, Realtime, pausa, retomada e desconexão.

