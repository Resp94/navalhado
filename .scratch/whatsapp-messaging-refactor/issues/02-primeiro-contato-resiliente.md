# 02 — Primeiro contato resiliente

**What to build:** Quando uma pessoa envia sua primeira mensagem elegível pelo WhatsApp, o sistema encontra ou cria o cliente, preserva o nome recebido, envia a mensagem correta no máximo uma vez por dia e suporta repetição segura do webhook.

**Blocked by:** 01 — Seam de despacho e baseline de regressão

**Status:** done

- [x] O RPC de localização/criação é chamado com o contrato público vigente e preserva o nome do contato.
- [x] O fluxo funciona tanto para cliente já existente quanto para cliente novo dentro do tenant autenticado pela instância.
- [x] A primeira mensagem do dia é enviada pelo dispatcher com chave de idempotência determinística também reconhecida pelo provider.
- [x] Uma repetição do mesmo evento externo não cria cliente duplicado nem envia mensagem duplicada.
- [x] Uma segunda mensagem elegível no mesmo dia respeita a regra diária atual.
- [x] Falha de RPC, erro temporário do provider e interrupção após aceite do provider ficam reprocessáveis sem duplicidade.
- [x] Eventos de grupo, mensagens próprias e eventos sem telefone válido continuam sendo ignorados conforme o comportamento atual.
