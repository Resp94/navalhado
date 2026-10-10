import { ContatosDoSiteError, STATUS_DO_CONTATO, type ContatoDoSite, type IContatosDoSiteAdapter, type PaginaDeContatos, type StatusDoContato } from './types';

/** API do módulo Contatos do Site: o que a aba Contatos do painel do Proprietário chama. */
export class ContatosDoSiteRepository {
  private readonly adapter: IContatosDoSiteAdapter;
  private readonly assinantes = new Set<() => void>();

  constructor(adapter: IContatosDoSiteAdapter) {
    this.adapter = adapter;
  }

  /** As mensagens mais novas primeiro, de um status (ou de todos, com `filtro` nulo); `antesDe` pede a página seguinte. */
  listar(filtro: StatusDoContato | null, antesDe: number | null): Promise<PaginaDeContatos> {
    return this.adapter.listar(filtro, antesDe);
  }

  /** Abrir uma mensagem nova a marca como lida; abrir uma lida ou respondida não muda nada. */
  async abrir(contato: ContatoDoSite): Promise<ContatoDoSite> {
    if (contato.status !== 'novo') return contato;
    return this.marcar(contato.id, 'lido');
  }

  async marcar(id: number, status: StatusDoContato): Promise<ContatoDoSite> {
    if (!STATUS_DO_CONTATO.includes(status)) throw new ContatosDoSiteError('status-invalido');
    const contato = await this.adapter.marcar(id, status);
    this.assinantes.forEach((avisar) => avisar());
    return contato;
  }

  /** Avisa depois de cada mudança de status gravada (o contador de novos se atualiza na hora). Devolve como cancelar o aviso. */
  aoMudar(avisar: () => void): () => void {
    this.assinantes.add(avisar);
    return () => {
      this.assinantes.delete(avisar);
    };
  }
}
