/** O que o Gerente lê quando o provedor de WhatsApp não responde (a Edge Function devolve 502 ou 504). */
export const MENSAGEM_O_WHATSAPP_DEMOROU = 'O serviço de WhatsApp demorou para responder. Tente de novo em instantes.';

// Textos genéricos do supabase-js quando a Edge Function recusa ou não responde: não dizem nada ao Gerente.
const TEXTOS_GENERICOS_DO_SUPABASE = new Set([
  'Edge Function returned a non-2xx status code',
  'Failed to send a request to the Edge Function',
  'Relay Error invoking the Edge Function',
]);

type ErroDaFuncao = { name?: string; message?: string; context?: { status?: number } } | null | undefined;

/**
 * Texto do aviso quando uma chamada à Edge Function do WhatsApp falha. A função responde com texto técnico, às vezes em inglês, e o
 * supabase-js o troca por um texto genérico dele; o Gerente lê português. Falha do provedor (502 e 504) vira "demorou para
 * responder", o texto genérico do supabase-js vira o texto padrão da ação e um texto próprio já em português passa como está.
 */
export const mensagemDaFalhaDaFuncao = (erro: ErroDaFuncao, padrao: string): string => {
  const status = erro?.context?.status;
  if (status === 502 || status === 504) return MENSAGEM_O_WHATSAPP_DEMOROU;

  const texto = erro?.message?.trim();
  if (!texto || TEXTOS_GENERICOS_DO_SUPABASE.has(texto)) return padrao;
  return texto;
};
