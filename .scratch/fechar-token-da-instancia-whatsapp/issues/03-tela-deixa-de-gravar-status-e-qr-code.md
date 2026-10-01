# 03: A tela deixa de gravar `status` e `qr_code`

Parte da spec 053 (Fechar o token da Instância WhatsApp no navegador).

**What to build:** conectar e desconectar o WhatsApp deixam de gravar `status` e `qr_code` direto na tabela pelo navegador. Quem grava é a Edge Function, que já fala com o provedor. A tela fica compatível com o banco do passo 1 e com o do passo 2.

- **`handleConnect`** (`src/pages/gerente/Whatsapp.tsx`, hoje linha 397): remove o `.update({ status: 'connecting', qr_code: null, updated_at })`. A tela marca localmente `connecting` e `qr_code: null` e invoca `whatsapp-integration/manage-instance` com a ação `connect`. O tratamento de erro (consultar o status ao falhar) não muda.
- **`handleDisconnect`** (hoje linha 494): remove o `.update` que vem depois da Edge Function. A Edge Function `disconnect` já grava `disconnected`, QR nulo e `updated_at` depois de o provedor confirmar. A tela atualiza o estado local com o retorno e mostra o mesmo aviso.
- **Edge Function** `supabase/functions/whatsapp-integration/index.ts`, ação `connect` (não a `resume`): antes de chamar `provider.connectInstance`, grava `status = 'connecting'`, `qr_code = null` e `updated_at = now()`. A sincronização da mesma chamada (`syncProviderStatus`) tem de ver essa linha já gravada, seja relendo a linha, seja atualizando o `dbInstance` local: a janela de pareamento (`isRecentPairing`, status `connecting` com `updated_at` de menos de 150 segundos) é o que faz um `disconnected` transitório do provedor ser ignorado. Se o provedor falha, `revertInstanceToDisconnected` (já existe) volta para `disconnected`.
- `handleUpdateConfig` e `handleSaveTemplate` não mudam: os payloads já cabem na lista de escrita da spec.
- Ao publicar a função, manter `verify_jwt` como está (falso nos dois ambientes, porque o webhook da Uazapi não manda JWT). Conferir com `list_edge_functions` antes e depois.

**Blocked by:** None (can start immediately). Funciona com o banco antes e depois do ticket 02.

**Status:** ready-for-agent

- [ ] Vitest (`Whatsapp.test.tsx`): conectar e desconectar não chamam `.update` em `whatsapp_instances` (o teste "deve iniciar pareamento invocando a edge function manage-instance" hoje espera `mockUpdate` com `status: 'connecting'` e passa a esperar que `mockUpdate` não seja chamado, mantendo a asserção do `invoke`); a lista do `select` continua a mesma; os payloads de configuração e de modelo continuam iguais; o teste do Realtime com `instance_token` no payload continua passando
- [ ] Deno (`index_test.ts`): o `connect` grava `connecting`, QR nulo e `updated_at` antes de chamar o provedor; a gravação acontece antes da chamada ao provedor; falha do provedor reverte para `disconnected`; os testes da janela de pareamento continuam passando; `resume` não faz a pré-gravação
- [ ] Roteiro no DEV (o usuário digita a senha): "Gerar QR Code de Conexão" mostra o QR e a tela segue pareando; a tela volta ao estado inicial depois de "Desconectar Aparelho" (com a instância do DEV conectada, ou pela Edge Function por chamada direta, sem mensagem real saindo)
- [ ] Função publicada no DEV, com `verify_jwt` inalterado e conferida com `get_edge_function`
- [ ] `npm run lint`, `npm test` e `npm run build` passam
