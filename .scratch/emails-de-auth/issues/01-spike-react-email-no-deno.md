# 01: Spike: React Email 6 no Deno das Edge Functions

**What to build:** a resposta à pergunta "o React Email 6 roda numa Edge Function do Supabase, importado por um mapa de imports da função, dentro do limite de 5 s do Send Email Hook?". O desenho da spec 049 depende disso. Isto é um spike: a função é descartável e nunca é commitada. O entregável é o resultado registrado na spec.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Função descartável no DEV importa `react-email`, `react` e `standardwebhooks` com versões fixas pelo mapa de imports, e o deploy aceita
- [x] O render gera HTML e texto puro de um template com Tailwind e `pixelBasedPreset`
- [x] Tempo de render medido e registrado em ms (cold e warm)
- [ ] Tempo de uma chamada quente completa (render mais envio real ao Resend) — não medida neste spike; ver Resultado
- [x] Plano B (`@react-email/components`) não foi necessário: o plano principal funcionou de primeira
- [x] Função neutralizada no fim (responde 410); só o dashboard apaga de vez
- [x] Resultado e recomendação registrados na spec 049; tempo medido bem abaixo de 5 s, desenho segue sem mudança

## Resultado (2026-09-24)

Função `spike-049-ticket01` publicada no DEV (`selvxobcjbkligxighlp`), com `deno.json` como mapa de imports (`react@19.3.0`, `react-email@6.11.0`, `standardwebhooks@1.0.0` via npm/esm.sh) e um template `.tsx` com `Tailwind`/`pixelBasedPreset`, igual ao que os tickets 02 e 03 vão usar. Deploy aceitou de primeira.

**Achado que corrige a spec:** o entrypoint precisa ser `.tsx`, não `.ts`. Um `.ts` com JSX falha o bundling (`Expected '>', got 'url'`) mesmo com `compilerOptions.jsx` no `deno.json` — a extensão do arquivo, não só a config, decide se o parser aceita JSX. `index.ts` vira `index.tsx` nos tickets 02, 03 e na spec.

**Tempo de render** (dentro da função, `performance.now()`, três chamadas): HTML 70–73 ms, texto puro 13 ms, total 83–86 ms. Estável entre a primeira chamada (cold) e as seguintes (warm) — a diferença ficou só no tempo de rede até aqui (1,4–3,3 s, medido deste terminal até `sa-east-1`; não representa a latência real entre o Auth e a função, que roda na mesma infraestrutura).

**Não medido:** o envio real ao Resend a partir de dentro da função. A função não tinha `RESEND_API_KEY` (nenhuma ferramenta do MCP do Supabase cadastra secret; isso é passo do usuário, no ticket 02) e o conector do Resend exige confirmação explícita do usuário para cada envio (`from` não pode ser preenchido por mim). Como o render sozinho já fica em ~85 ms, e a chamada HTTP ao Resend costuma ficar na casa de algumas centenas de ms, a soma continua folgada dentro do limite de 5 s. O ticket 02 mede o caminho completo, com o Resend real.

**Recomendação:** segue com React Email 6 (`react-email` unificado) e `deno.json` como mapa de imports, com entrypoint `.tsx`. Sem necessidade do plano B.
