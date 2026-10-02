import { MENSAGEM_VERSAO_INVALIDA } from './errors';
import type { ITermosAdapter } from './types';

// A versão é a data de publicação do texto. O banco confere o mesmo formato (accept_terms e a tabela terms_acceptances).
const FORMATO_DA_VERSAO = /^\d{4}-\d{2}-\d{2}$/;

const exigirVersao = (versao: string) => {
  if (!FORMATO_DA_VERSAO.test(versao)) throw new Error(MENSAGEM_VERSAO_INVALIDA);
};

export class TermosRepository {
  private adapter: ITermosAdapter;

  constructor(adapter: ITermosAdapter) {
    this.adapter = adapter;
  }

  /** O usuário logado já aceitou esta versão? A falha sobe: quem chama decide se abre ou fecha. */
  async jaAceitou(versao: string): Promise<boolean> {
    exigirVersao(versao);
    return this.adapter.jaAceitou(versao);
  }

  /** Registra o aceite do usuário logado, com a versão e a data (a do banco). Aceitar de novo a mesma versão não é erro. */
  async aceitar(versao: string): Promise<void> {
    exigirVersao(versao);
    await this.adapter.aceitar(versao);
  }
}
