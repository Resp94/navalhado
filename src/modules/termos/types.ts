/** Os dois textos que o Gerente aceita: os Termos de Uso e a Política de Privacidade da plataforma. */
export type DocumentoLegal = 'termos' | 'privacidade';

export interface SecaoDoTexto {
  titulo: string;
  paragrafos: string[];
}

export interface TextoLegal {
  titulo: string;
  secoes: SecaoDoTexto[];
}

/**
 * Onde está o aceite da versão atual dos termos: `carregando` enquanto a leitura não voltou, `pendente` (o Gerente precisa
 * aceitar), `aceito` e `indisponivel` (a leitura falhou: o painel abre, o aceite não fecha ninguém por falha de rede).
 */
export type SituacaoDoAceite = 'carregando' | 'pendente' | 'aceito' | 'indisponivel';

export interface ITermosAdapter {
  /** O usuário logado já aceitou esta versão? */
  jaAceitou(versao: string): Promise<boolean>;
  /** Grava o aceite do usuário logado. Aceitar de novo a mesma versão não muda nada (vale a data do primeiro aceite). */
  aceitar(versao: string): Promise<void>;
}
