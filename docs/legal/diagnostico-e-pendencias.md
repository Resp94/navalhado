# Diagnóstico: Termos de Uso e Política de Privacidade (05/10/2026)

O ponto de partida foi o texto em produção de código: `src/modules/termos/textos.ts`, versão 2026-10-02, o rascunho técnico do ticket 16 da spec 052. A partir dele, escrevemos as minutas novas:

- [termos-de-uso.md](termos-de-uso.md)
- [politica-de-privacidade.md](politica-de-privacidade.md)

Este documento lista:

- o que o texto antigo tinha de irregular;
- o que só se resolve **mudando o sistema**;
- o que o advogado precisa decidir.

> Feito por IA a partir do código e do banco do DEV. Não substitui a revisão de um advogado especializado em proteção de dados e direito digital.

## 1. Problemas do texto antigo e como as minutas tratam cada um

| # | Problema no texto de 2026-10-02 | Norma | Como ficou nas minutas |
|---|---|---|---|
| 1 | Não identifica o fornecedor (nome, CNPJ, endereço, contato) | Decreto 7.962/2013, art. 2º; LGPD, art. 9º | Cabeçalho com os dados, alguns `[A DEFINIR]` |
| 2 | Não separa controlador e operador: trata os dados dos clientes da barbearia como se fossem do Navalhado | LGPD, arts. 5º, VI e VII, 37 a 39 | Seção 3 da Política e Anexo I (acordo de tratamento) nos Termos |
| 3 | Base legal genérica ("execução de contrato e legítimo interesse") para tudo | LGPD, arts. 6º e 7º | Tabela de dado → finalidade → base legal |
| 4 | Suboperadores sem nome ("o provedor de WhatsApp") | LGPD, art. 9º, V | Lista nominal: Supabase, Cloudflare, Uazapi, Mercado Pago, Resend, Google, ViaCEP e BrasilAPI |
| 5 | Não fala de transferência internacional (Cloudflare, Resend e Google estão fora do Brasil) | LGPD, art. 33; Res. ANPD 19/2024 | Seção 7 da Política |
| 6 | Guarda "sem prazo" dos dados depois do cancelamento | LGPD, arts. 6º, III, 15 e 16 (fim do tratamento) | Prazo `[A DEFINIR]` (sugestão: 12 meses) e exclusão a pedido |
| 7 | Lista incompleta dos direitos do titular, sem prazo de resposta nem canal real | LGPD, arts. 18 e 19 | Os 9 direitos, o prazo de 15 dias e privacidade@navalhado.com.br |
| 8 | "Nada é reembolsado": conflita com o direito de arrependimento se a barbearia for consumidora (MEI ou pequeno negócio vulnerável) | CDC, art. 49; Decreto 7.962/2013, art. 5º | 7 dias depois da primeira cobrança, com devolução integral (cláusula 11.2) |
| 9 | Mudança dos termos sem aviso prévio nem direito de sair | CDC, art. 51, IV, X, XI e XIII | 15 dias de aviso e cancelamento sem multa (cláusula 17) |
| 10 | Não fala de reajuste de preço | CDC, art. 51, X | Até 1 reajuste a cada 12 meses, com 30 dias de aviso (cláusula 9.4) |
| 11 | Bloqueio por "uso indevido" sem aviso nem contestação | CDC, art. 51, IV; boa-fé | Aviso e 5 dias para corrigir, salvo urgência (cláusula 14) |
| 12 | Não fala de foro, limitação de responsabilidade, licença, uso aceitável, logs, incidentes, menores, IA e cookies | Lei 14.879/2024; CDC, art. 51, I; Marco Civil, art. 15; Res. ANPD 15/2024; ECA Digital; Guia ANPD de cookies | Cláusulas próprias em cada minuta |
| 13 | Não avisa que a integração do WhatsApp não é oficial e pode levar à restrição do número | CDC, art. 6º, III (informação) | Cláusula 8 dos Termos |
| 14 | A Política não fala do cliente que agenda pelo link (Turnstile, sessão anônima) nem do cliente criado sozinho a partir do WhatsApp | LGPD, art. 9º | Seções 4.2 e 4.3 da Política |

## 2. Pendências que exigem mudança no sistema (antes de publicar na PROD)

As minutas descrevem o comportamento **correto**. Nestes pontos, o sistema ainda não faz o que o texto promete. Publicar o texto sem resolvê-los cria uma promessa falsa. Sugestão: uma spec com estes tickets.

| Prioridade | Pendência | Por quê |
|---|---|---|
| **Alta** | **Guardar os registros de acesso (IP, data e hora) por 6 meses.** Hoje o `audit_logs.ip_address` nunca é preenchido, e os logs do Supabase duram poucos dias, conforme o plano. | Obrigação legal do provedor de aplicação (Marco Civil, art. 15). Sem isso, a cláusula 13.4 é falsa |
| **Alta** | **Deixar o cliente pedir para não receber mais mensagens** (ex.: responder "SAIR" no WhatsApp marca o cliente) e **deixar a barbearia desligar o lembrete de retorno**. Hoje ele é promocional ("Que tal renovar o visual?"), roda para toda instância conectada e não tem opt-out. | Marketing direto com base no legítimo interesse exige o direito de oposição (LGPD, art. 18, § 2º); também reduz o risco de banimento do número |
| **Alta** | **Mostrar um aviso de privacidade ao cliente no Canal do Cliente** (link para a Política, junto do formulário de nome e telefone). Hoje o cliente não vê termo nem privacidade (lacuna já anotada no ticket 16). | Transparência no momento da coleta (LGPD, art. 9º) |
| Média | **Rotina de eliminação** dos dados de barbearias canceladas ou bloqueadas depois do prazo da cláusula 13.3, e das sessões anônimas vencidas. Hoje não há expurgo nenhum. | Fim do tratamento (LGPD, arts. 15 e 16) |
| Média | **Fluxo de exclusão da conta e da barbearia** (mesmo que manual, por um roteiro do Proprietário). Hoje não existe. | Direito de eliminação (art. 18, VI) |
| Média | **Fortalecer a prova do aceite:** guardar IP e user agent no `terms_acceptances`, não apagar o aceite junto do usuário (hoje é `on delete cascade`) e arquivar o texto de cada versão (ou o hash dele). | Prova do contrato (CPC; LGPD, art. 8º, § 2º, ônus da prova do controlador) |
| Média | **Fluxo de reembolso do arrependimento** (cláusula 11.2): estorno pelo Mercado Pago, pela tela ou pelo suporte. | Se a cláusula ficar, o sistema precisa cumpri-la |
| Média | **Publicar os textos numa URL pública** (ex.: navalhado.com.br/termos e /privacidade). Hoje só abrem num modal no login e no cadastro. | Decreto 7.962/2013, art. 4º, IV (contrato disponível para salvar e imprimir) |
| Baixa | **Servir as fontes do próprio site**, em vez do Google Fonts. | Elimina uma transferência internacional de IP sem necessidade |
| Baixa | Trocar o exemplo do campo de observações do cliente ("restrições"), que induz a registrar dado de saúde. | Minimização; risco de dado sensível sem base do art. 11 |
| Baixa | Mostrar em Configurações os links dos textos e a versão e a data aceitas. | Transparência (pendência já anotada no ticket 16) |
| Baixa | Ativar o MFA para o Proprietário e o acesso administrativo. | Segurança do acesso transversal a todas as barbearias |

Ao publicar o texto novo no código (`textos.ts`), é preciso mudar `VERSAO_ATUAL_DOS_TERMOS`. Isso faz todos os Gerentes aceitarem de novo, o que é o comportamento esperado. Pela própria cláusula 17, o aviso aos Gerentes já cadastrados deve sair 15 dias antes da vigência.

## 3. Decisões para o advogado (e para você)

1. **Prazo de guarda depois do cancelamento** (sugerido: 12 meses). Hoje o sistema guarda para sempre.
2. **Arrependimento de 7 dias depois da 1ª cobrança.** Com um teste grátis sem cartão, dá para defender que o art. 49 do CDC não se aplica, ou que a barbearia (B2B) não é consumidora. A minuta adotou a versão protetiva, de custo baixo. Confirmar.
3. **A barbearia é consumidora?** Isso define se a limitação de responsabilidade (16.2) e o foro valem como escritos. A minuta trata os dois cenários.
4. **Pequeno porte e encarregado:** confirmar que o Navalhado se enquadra na Res. ANPD 2/2022, isto é, que não faz tratamento de alto risco. A base de clientes de todas as barbearias pode ser considerada "larga escala".
5. **Salvaguarda de cada transferência internacional:** conferir se Cloudflare, Resend, Supabase e Uazapi adotaram as cláusulas-padrão da ANPD (o prazo de adaptação da Res. 19/2024 acabou em agosto de 2025) e qual é o país da Uazapi.
6. **Uso de uma API não oficial do WhatsApp:** risco contratual com a Meta e com as barbearias. A cláusula 8 informa o risco, mas não o elimina.
7. **Bloqueio imediato por estorno ou contestação** (12.3): confirmar que ele é proporcional, com a ressalva do contato pelo suporte.
8. **Dados do MEI** (titular, CNPJ, endereço): com MEI, o nome civil do titular fica público nos textos. Avaliar se o endereço comercial pode ser outro, como um endereço fiscal ou de coworking.
9. **Notas fiscais:** se o Navalhado emite NFS-e da assinatura, a Política precisa citar o dado e o prazo de 5 anos (já previsto genericamente).

## 4. Campos `[A DEFINIR]` nas minutas

- Nome do titular, CNPJ e endereço (Termos, cláusula 1; Política, seção 1).
- O responsável pelo canal de privacidade (Política, seção 1.1).
- A razão social e o país da Uazapi (Política, seção 6).
- O país de tratamento do Mercado Pago (Política, seção 6, `[A CONFIRMAR]`).
- O prazo de guarda depois do cancelamento (Política, seção 8; Termos, cláusula 13.3).
- A URL pública dos termos (Termos, cláusula 4.3).
- O desligamento do lembrete de retorno (Termos, cláusula 8.4, até a pendência do item 2 ser resolvida).
- Confirmar que suporte@navalhado.com.br e privacidade@navalhado.com.br existem e recebem e-mail.
