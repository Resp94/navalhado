import type { IContatosDoSiteAdapter, PaginaDeContatos } from './types';

/** API do módulo Contatos do Site: o que a aba Contatos do painel do Proprietário chama. */
export class ContatosDoSiteRepository {
  private readonly adapter: IContatosDoSiteAdapter;

  constructor(adapter: IContatosDoSiteAdapter) {
    this.adapter = adapter;
  }

  /** As mensagens mais novas primeiro. */
  listar(): Promise<PaginaDeContatos> {
    return this.adapter.listar();
  }
}
