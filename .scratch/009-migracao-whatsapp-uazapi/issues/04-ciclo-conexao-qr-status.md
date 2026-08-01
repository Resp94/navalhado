# 04 — Parear e administrar o ciclo de conexão

**What to build:** Entregar ao Gerente o ciclo completo da Instância WhatsApp na Uazapi: gerar e renovar QR Code, observar o estado, concluir o pareamento, identificar pausa, retomar a sessão e desconectar completamente quando desejado.

**Blocked by:** 03 — Ativar uma instância pela Uazapi.

**Status:** completed

- [x] “Gerar QR Code” inicia a conexão usando exclusivamente o token da instância no backend.
- [x] O QR Code retornado pela conexão aparece imediatamente na interface.
- [x] Enquanto estiver pareando, consultas temporárias renovam QR Code e estado sem continuar indefinidamente.
- [x] Webhook e Realtime continuam atualizando o estado observado.
- [x] A consulta temporária termina ao conectar, desconectar, pausar, sair da tela ou atingir o limite de espera.
- [x] A interface apresenta conectado, pareando, desconectado e pausado com textos neutros de WhatsApp.
- [x] Uma instância pausada pode ser retomada sem novo QR Code.
- [x] “Desconectar” encerra a sessão e exige novo QR Code na próxima conexão.
- [x] Desconectar preserva a instância e as preferências de mensagens.
- [x] QR Code é limpo quando deixa de ser válido.
- [x] Falhas encerram o carregamento e permitem nova tentativa manual.
- [x] Testes cobrem resposta imediata, atualização temporária, Realtime, pausa, retomada e desconexão.
