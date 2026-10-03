import { describe, expect, it } from 'vitest';
import { MENSAGEM_O_WHATSAPP_DEMOROU, mensagemDaFalhaDaFuncao } from '../mensagemDaFalhaDaFuncao';

// A Edge Function do WhatsApp responde com texto técnico (às vezes em inglês) e o supabase-js troca a resposta por um texto genérico
// dele. Quem lê o aviso é o Gerente: cada falha vira uma frase em português.
describe('mensagemDaFalhaDaFuncao', () => {
  const PADRAO = 'Erro ao solicitar conexão de WhatsApp.';
  const erroHttp = (status: number, message = 'Edge Function returned a non-2xx status code') => ({ name: 'FunctionsHttpError', message, context: { status } });

  it.each([502, 504])('diz que o WhatsApp demorou para responder quando a função devolve %i (falha do provedor)', (status) => {
    expect(mensagemDaFalhaDaFuncao(erroHttp(status), PADRAO)).toBe(MENSAGEM_O_WHATSAPP_DEMOROU);
  });

  it('o status do provedor vale mesmo que o erro traga um texto próprio', () => {
    expect(mensagemDaFalhaDaFuncao(erroHttp(502, 'WhatsApp provider request failed'), PADRAO)).toBe(MENSAGEM_O_WHATSAPP_DEMOROU);
  });

  it.each([
    'Edge Function returned a non-2xx status code',
    'Failed to send a request to the Edge Function',
    'Relay Error invoking the Edge Function',
  ])('troca o texto genérico do supabase-js "%s" pelo texto padrão da ação', (message) => {
    expect(mensagemDaFalhaDaFuncao({ name: 'FunctionsHttpError', message, context: { status: 500 } }, PADRAO)).toBe(PADRAO);
    expect(mensagemDaFalhaDaFuncao({ name: 'FunctionsFetchError', message }, PADRAO)).toBe(PADRAO);
  });

  it('mantém um texto próprio que já esteja em português', () => {
    expect(mensagemDaFalhaDaFuncao({ message: 'A ativação não retornou uma instância válida.' }, PADRAO)).toBe('A ativação não retornou uma instância válida.');
  });

  it.each([null, undefined, {}, { message: '' }, { message: '   ' }])('sem erro ou sem texto (%j) vale o texto padrão', (erro) => {
    expect(mensagemDaFalhaDaFuncao(erro, PADRAO)).toBe(PADRAO);
  });
});
