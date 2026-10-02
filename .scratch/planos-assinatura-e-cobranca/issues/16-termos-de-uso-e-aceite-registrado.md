# 16: Termos de uso e aceite registrado

Parte da spec 052 (Planos, assinatura e cobrança recorrente).

**What to build:** o Gerente aceita Termos de Uso e uma Política de Privacidade que explicam a assinatura, e o aceite fica registrado.

- **Termos de Uso** com as cláusulas:
  - preço e renovação mensal automática
  - teste de 15 dias
  - cancelamento com acesso até o fim do período pago
  - subida de plano com cobrança proporcional
  - descida sem reembolso
  - suspensão no 5º dia de pagamento recusado, com os avisos prévios
  - guarda dos dados sem prazo, com exportação
  - exclusão da Instância WhatsApp no 7º dia de bloqueio
- **Política de Privacidade:** os dados ficam guardados sem prazo depois do cancelamento, com exportação pela tela e exclusão a pedido pelo suporte.
- Os textos têm versão.
- O aceite é gravado por usuário, com a versão e a data.
- O cadastro exige marcar "li e aceito".
- O Gerente que ainda não aceitou a versão atual vê o aceite antes de entrar no painel.
- O texto é um rascunho técnico, revisado por advogado antes do lançamento em prod.

**Blocked by:** 01 (Catálogo Tesoura, Máquina e Bancada)

**Status:** in-progress

- [x] pgTAP: o usuário grava e lê só o próprio aceite (pgTAP 79: 60 asserções, 60 ok no DEV; seis mutações do banco derrubadas pelo teste)
- [x] Teste do cadastro: não conclui sem marcar o aceite; grava versão e data (o front manda `terms_version` e trava o envio sem o aceite; o gatilho grava a versão e a data do banco, provado no pgTAP 79)
- [x] Teste do layout do Gerente: sem aceite da versão atual, mostra o aceite antes do painel (e antes da tela de bloqueio e do onboarding); com aceite, segue normal
- [x] Os links de termos e privacidade do login e do cadastro abrem os textos novos
- [x] Anotado no resultado: o texto precisa de revisão por advogado antes de prod (ver "O que o advogado precisa rever")
- [ ] `npm run lint`, `npm test` e `npm run build` passam
- [ ] Revisão de código (`/code-review`, nível max) feita e os achados aplicados

## Resultado (2026-10-02)

**Banco** (migration `20261002193345_052_ticket16_termos_de_uso_e_aceite_registrado`, aplicada só no DEV):
- `public.terms_acceptances` (`id`, `user_id` → `public.users` com `on delete cascade`, `version`, `accepted_at` com `default now()`), única por `(user_id, version)`; a `version` só aceita o formato `AAAA-MM-DD` (constraint). RLS ligada, sem privilégio nenhum para `anon` e só `select` para `authenticated`, com uma política de leitura: `user_id = auth.uid()`. Ninguém do navegador escreve: nenhuma política de escrita, nenhum privilégio.
- `public.accept_terms(p_version text) returns timestamptz` (`security definer`, `search_path` vazio, `execute` só para `authenticated`): grava o aceite de quem chama e devolve a data do aceite. Recusa versão fora do formato (`INVALID_VERSION`, 22023) e quem não tem linha em `public.users`, como o login anônimo, ou não tem sessão (`FORBIDDEN`, 42501). É idempotente: aceitar de novo a mesma versão devolve a data do primeiro aceite e não muda nada.
- `public.handle_new_user()` (a do ticket 03, mais o aceite no fim): se `raw_user_meta_data.terms_version` tem o formato de uma versão, grava o aceite do usuário novo com a data do banco. Versão ausente ou mal formada (texto, vazio, número, objeto) não grava nada e não derruba a criação da conta.
- **pgTAP 79** (`79_termos_de_uso_e_aceite_registrado.test.sql`, 60 asserções, 60 ok no DEV): a estrutura e os privilégios; aceitar, a idempotência (a data do primeiro aceite sobrevive a um segundo), uma versão nova ao lado da antiga, seis versões inválidas, o anônimo, a chamada sem usuário e o `anon`; cada um lê só o seu (Gerente, o outro Gerente da mesma barbearia, Barbeiro, Gerente com `tenant_id` nulo, Proprietário, `anon`); o navegador não grava, não grava em nome de outro, não muda a data e não apaga; o cadastro com a versão, sem ela, com versão mal formada, do usuário sem barbearia e anônimo; apagar o usuário apaga os aceites; as constraints da tabela. As seis mutações abaixo foram rodadas contra o teste (na mesma transação do runner, que termina em erro e desfaz tudo; o DEV ficou intacto) e todas derrubaram asserções: RLS aberta (5), `do update` no lugar de `do nothing` (2), sem a checagem de `public.users` (1), escrita liberada a `authenticated` (3), gatilho sem tolerância à versão mal formada (2), função sem o formato (5).

**Módulo `src/modules/termos/`** (o padrão dos outros): `TermosRepository` (`jaAceitou(versao)` e `aceitar(versao)`, que confere o formato antes de falar com o adaptador), `SupabaseTermosAdapter` (lê `terms_acceptances` só pela coluna `version`, filtrando a versão, e grava por `accept_terms`; o erro do banco fica na `cause` e o Gerente lê `MENSAGEM_ACEITAR_FALHOU`), `InMemoryTermosAdapter`, `repositorio.ts`, `useAceiteDosTermos` (situações `carregando`, `pendente`, `aceito` e `indisponivel`; a gravação reaproveita `useAcaoDoGerente`) e `textos.ts`, com a versão (`VERSAO_ATUAL_DOS_TERMOS = '2026-10-02'`), os Termos de Uso (12 seções), a Política de Privacidade (7) e `dataDaVersao`.

**Telas:**
- `TelaDeAceiteDosTermos`: "Termos de Uso e Política de Privacidade", a versão, dois botões que abrem os textos, "Li e aceito", o erro em `role="alert"`, "Aceitar e continuar" (travado até marcar; "Registrando…" enquanto grava) e "Sair da conta". O `GerenteLayout` a mostra antes do painel, do onboarding e da tela de bloqueio; aceitar libera o painel sem recarregar. Se a leitura do aceite falha, o painel abre.
- `CadastroBarbearia`: caixa "Li e aceito os Termos de Uso e a Política de Privacidade." com os dois links logo abaixo; "Criar conta" fica travado sem ela e o envio do formulário fora do botão também é barrado (aviso `warning`); o `signUp` manda `terms_version`.
- `Login` e `CadastroBarbearia` (links do rodapé): abrem `TermosDaPlataformaModal`, com os textos novos. O Canal do Cliente (`MenuCliente`) segue com o `LegalModal` de antes: o cliente da barbearia não contrata a assinatura.

**Texto.** Os Termos de Uso têm as oito cláusulas da spec, cada uma escrita a partir do que o sistema faz (as datas, os prazos e o que fica ou sai conferem com o glossário), mais o aceite, o uso da conta (herdado do texto antigo), os serviços de terceiros e a mudança dos termos. Não escreve preço: o preço mora no banco e aparece no cadastro e na tela Assinatura (o teste proíbe `R$` e valor em reais nos dois textos). Diz "bloqueio", e não "suspensão", como o glossário.

### Decisões
- **A versão é a data de publicação do texto, e quem a define é o front.** Os textos moram no código (`textos.ts`) e a constante é a versão atual; o banco só guarda e confere o formato. Uma tabela de versões no banco ou o texto no banco obrigaria cada mudança de texto a passar por migration, e deixaria o painel de todos os Gerentes fechado se a migration chegasse antes do front (a versão nova não teria texto para mostrar).
- **O aceite é regra do front, como o bloqueio do painel.** Se a leitura do aceite falha, o painel abre (um erro de rede, ou a migration ainda não aplicada no ambiente, não trava ninguém); o Gerente vê a tela no acesso seguinte. O banco guarda o aceite, e não fecha dados por falta dele.
- **O aceite vem antes da tela de bloqueio.** Quem vai pagar a assinatura está contratando; a tela de bloqueio tem o "Pagar".
- **O cadastro sem a versão não é recusado pelo banco.** O cadastro novo exige o aceite (front), e o gatilho grava a versão que veio. Mas um `signUp` chamado direto, sem `terms_version`, cria a conta (nenhum teste ou fluxo existente a manda, e a recusa quebraria o cadastro do front antigo, que ainda pode estar em cache): o Gerente aceita na primeira entrada, porque o porteiro o barra até lá. Versão mal formada também não derruba a conta, pelo mesmo motivo.
- **Quem já existe não ganha aceite.** Sem backfill: todo Gerente vê a tela no próximo acesso depois do deploy; é o que a spec pede ("o Gerente que ainda não aceitou a versão atual vê o aceite antes de entrar no painel").
- **Só o Gerente passa pelo porteiro**, como a spec escreve. O Barbeiro e o Proprietário também podem aceitar (a função não olha o papel), mas nenhuma tela os barra.
- **Cada um lê só os seus aceites**, o Proprietário também: não foi pedido. Se a auditoria precisar, é uma função própria.
- **Novo modal, e o `LegalModal` fica para o cliente.** O texto da plataforma tem cláusulas de assinatura que não valem para quem agenda um corte. Um `variante` no `LegalModal` poderia ser esquecido num chamador; dois componentes não.
- **A tela mostra os links e o "Li e aceito" separados**, como o cadastro: ler os textos não marca o aceite. Os links ficam fora do `<label>` da caixa, porque um botão dentro de um `<label>` é HTML inválido.

### O que o advogado precisa rever (antes de prod)
O texto é um rascunho técnico. Pontos que um advogado precisa decidir, que o texto não decide: foro e lei aplicável; limitação de responsabilidade; reajuste de preço e o aviso dele; "nada é reembolsado" frente ao direito de arrependimento (CDC, art. 49) se a barbearia contratante for consumidora; o bloqueio na hora por estorno ou contestação; controlador e operador na LGPD (a barbearia e o Navalhado) e o encarregado (DPO); a guarda "sem prazo" frente aos princípios de finalidade e necessidade da LGPD, e o que fica depois de um pedido de exclusão (dados fiscais); o canal de contato do suporte, que o texto cita ("exclusão a pedido pelo suporte") sem endereço; e "poderes para contratar em nome da barbearia".

### Conferido no DEV (2026-10-02)
- **Regressão do `handle_new_user` reescrito:** pgTAP 60 (4/4), 61 (5/5), 63 (12/12), 65 (76/76) e `anonymous_auth_trigger` (2/2) sem falha; `security_hardening` 11/12, com a mesma falha de antes (a 12, de `comanda_pagamentos`: o achado antigo e conhecido, fora desta spec).
- **Advisors de segurança do DEV:** dois avisos novos, os dois da mesma classe dos 94 e dos 41 que já existiam: `accept_terms` executável por `authenticated` (de propósito: é a porta do navegador) e a política de leitura de `terms_acceptances`, que vale para `authenticated` (o login anônimo também é `authenticated`, mas não tem aceite nenhum). Nenhum aviso de performance (a chave estrangeira `user_id` é a coluna da frente da chave única).
- **Cadastro no navegador do app** (`localhost:5173/signup`, banco do DEV, sem enviar nada): na etapa 2 a caixa "Li e aceito os Termos de Uso e a Política de Privacidade." aparece com os dois links logo abaixo, "Criar conta" fica desligado, e os dois links abrem os textos novos (Termos de Uso com as 12 seções e a versão "Versão de 02/10/2026"; Política de Privacidade com as 7), sem erro no console. O título de cada seção passou a ser em negrito depois dessa conferência.

### Limitações
- **Só o DEV.** A migration não foi para a prod: entra junto dos tickets 07 a 16, na ordem. O front pode ir antes dela (a leitura do aceite falha e o painel abre) ou depois.
- **O texto de cada versão antiga fica só no histórico do Git** (`textos.ts`). Para prova jurídica de "o que o usuário aceitou em tal data", vale arquivar cada versão publicada (um arquivo por versão, por exemplo) quando o texto mudar; a versão é a data de publicação e aponta o commit.
- **O banco não confere se a versão existe**, só o formato: quem chama a função direto pode gravar o aceite de uma data qualquer. Só prejudica o próprio usuário (o porteiro compara com a versão atual do front), e cada versão é uma linha única por usuário.
- **Quem não aceita só consegue sair da conta**, sem um caminho de "recusar e pedir a exclusão dos dados".
- **A tela de aceite e o clique em "Aceitar e continuar" não foram vistos num navegador com o login de um Gerente**: o login é do usuário. O cadastro (com a caixa, os links e os textos) foi visto no navegador do app, e o layout, a tela e o hook estão cobertos pelos testes do Vitest.
