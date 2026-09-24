# 01: Spike: React Email 6 no Deno das Edge Functions

**What to build:** a resposta à pergunta "o React Email 6 roda numa Edge Function do Supabase, importado por um mapa de imports da função, dentro do limite de 5 s do Send Email Hook?". O desenho da spec 049 depende disso. Isto é um spike: a função é descartável e nunca é commitada. O entregável é o resultado registrado na spec.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Função descartável no DEV importa `react-email`, `react` e `standardwebhooks` com versões fixas pelo mapa de imports, e o deploy aceita
- [ ] O render gera HTML e texto puro de um template com Tailwind e `pixelBasedPreset`
- [ ] Tempo de uma chamada fria e de uma quente (render mais envio ao Resend para um e-mail real do usuário) medido e registrado em ms
- [ ] Se falhar, o plano B (`@react-email/components`) é testado do mesmo jeito
- [ ] Função neutralizada no fim (responde 410); só o dashboard apaga de vez
- [ ] Resultado e recomendação registrados na spec 049; se o tempo ficar perto de 5 s, o desenho volta para discussão
