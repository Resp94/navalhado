# Snapshot operacional — correção do reagendamento tokenizado

**Data:** 28/08/2026 22:47 (America/Manaus)  
**Commit de referência:** `44b9f36`.  
**Working tree:** snapshot pendente de commit; código da correção já registrado localmente.

## Ambiente da validação

- Repositório local `C:\Projetos\navalhado`.
- Ambiente Dev remoto em `https://dev.navalhado.com.br`.
- Navegador integrado: link tokenizado autorizado, sem confirmar um novo agendamento.
- Banco Supabase remoto consultado por SQL e logs unificados.

## ✅ Funcional

- Link tokenizado abriu o painel do cliente e carregou o perfil de Jonathas.
- O fluxo avançou até a seleção de data, horário e modal de confirmação de reagendamento.
- O banco retornou o perfil do cliente e seus agendamentos; o token não estava expirado.
- O Adapter agora envia `p_appointment_id`, nome aceito pela RPC publicada.
- Teste regressivo confirma que a chamada correta conclui sem acionar o fallback inexistente.

## Regras críticas de preservação

- Manter o isolamento do Canal do Cliente por token e tenant.
- Não alterar as regras de disponibilidade, prazo ou conflito da RPC de reagendamento.
- Não editar migrations aplicadas; a assinatura correta já está versionada e publicada.
- Não alterar os fluxos de criação, cancelamento ou envio WhatsApp.

## ⚠️ Limitações e pendências conhecidas

- A publicação do build no Cloudflare Pages Dev não foi concluída porque o Wrangler não está instalado localmente e a tentativa de execução exigiria baixar o pacote; o commit corrige o código-fonte e o build local.
- A validação visual não confirmou o botão final de reagendamento para evitar alterar o agendamento real do cliente.
- A nova chamada deve ser validada no domínio Dev após o deploy do frontend.

## Verificações executadas

- Teste regressivo do Adapter — **1 aprovado** após a correção; falha reproduzida antes dela.
- Testes focados do Canal do Cliente — **33 aprovados**.
- Suíte completa `npm test` — **53 arquivos e 291 testes aprovados**.
- `npm run build` — **aprovado**, com aviso preexistente de bundle grande.
- `npm run lint` — **código 0**, somente avisos preexistentes.
- `git diff --check` — **aprovado**.
- Logs do banco — tentativas reais registraram `404` para a RPC com parâmetro antigo e para o fallback inexistente.

## Alterações desde o snapshot anterior

- Corrigido o nome do parâmetro enviado pelo Adapter de reagendamento.
- Adicionado teste regressivo do contrato da RPC.
