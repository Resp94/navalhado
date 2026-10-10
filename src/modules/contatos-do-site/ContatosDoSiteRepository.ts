import type { IContatosDoSiteAdapter, PaginaDeContatos, StatusDoContato } from './types';

/** API do módulo Contatos do Site: o que a aba Contatos do painel do Proprietário chama. */
export class ContatosDoSiteRepository {
  private readonly adapter: IContatosDoSiteAdapter;

  constructor(adapter: IContatosDoSiteAdapter) {
    this.adapter = adapter;
  }

  /** As mensagens mais novas primeiro, de um status (ou de todos, com `filtro` nulo); `antesDe` pede a página seguinte. */
  listar(filtro: StatusDoContato | null, antesDe: number | null): Promise<PaginaDeContatos> {
    return this.adapter.listar(filtro, antesDe);
  }
}
