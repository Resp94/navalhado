import { ContatosDoSiteError, type ContatoDoSite, type IContatosDoSiteAdapter, type PaginaDeContatos, type StatusDoContato } from '../types';

const TAMANHO_DA_PAGINA = 50;

/** Um Contato do Site para os testes, com o que não importar preenchido. */
export const contatoDeTeste = (parcial: Partial<ContatoDoSite> = {}): ContatoDoSite => ({
  id: 1,
  recebidoEm: new Date('2026-10-09T15:00:00Z'),
  nome: 'Ana',
  sobrenome: 'Souza',
  email: 'ana@exemplo.com',
  barbearia: 'Barbearia da Ana',
  assunto: 'Quero começar a usar',
  mensagem: 'Olá!',
  status: 'novo',
  ...parcial,
});

/** Fake do D1 do site para os testes: a mesma ordem (id decrescente) e a mesma página de 50 do Worker. */
export class InMemoryContatosDoSiteAdapter implements IContatosDoSiteAdapter {
  contatos: ContatoDoSite[];

  constructor(contatos: ContatoDoSite[] = []) {
    this.contatos = contatos.map((c) => ({ ...c }));
  }

  async listar(filtro: StatusDoContato | null, antesDe: number | null): Promise<PaginaDeContatos> {
    const ordenados = this.contatos
      .filter((c) => (filtro === null || c.status === filtro) && (antesDe === null || c.id < antesDe))
      .sort((a, b) => b.id - a.id);
    return {
      contatos: ordenados.slice(0, TAMANHO_DA_PAGINA).map((c) => ({ ...c })),
      haMais: ordenados.length > TAMANHO_DA_PAGINA,
    };
  }

  async marcar(id: number, status: StatusDoContato): Promise<ContatoDoSite> {
    const contato = this.contatos.find((c) => c.id === id);
    if (!contato) throw new ContatosDoSiteError('nao-encontrado');
    contato.status = status;
    return { ...contato };
  }
}
