import { ContatosDoSiteError, type ContatoDoSite, type IContatosDoSiteAdapter, type PaginaDeContatos, type StatusDoContato } from '../types';

/** A linha como o Worker devolve (worker/contatos.ts): `criado_em` é UTC no formato do SQLite (`AAAA-MM-DD HH:MM:SS`). */
interface ContatoDoWorker {
  id: number;
  criado_em: string;
  nome: string;
  sobrenome: string;
  email: string;
  barbearia: string | null;
  assunto: string;
  mensagem: string;
  status: StatusDoContato;
}

const ROTA = '/api/admin/contatos';

const paraContato = (linha: ContatoDoWorker): ContatoDoSite => ({
  id: linha.id,
  recebidoEm: new Date(`${linha.criado_em.replace(' ', 'T')}Z`),
  nome: linha.nome,
  sobrenome: linha.sobrenome,
  email: linha.email,
  barbearia: linha.barbearia,
  assunto: linha.assunto,
  mensagem: linha.mensagem,
  status: linha.status,
});

/** Fala com o Worker do app, na mesma origem, levando o token da sessão do Supabase (a guarda do Worker confere o Proprietário). */
export class WorkerContatosDoSiteAdapter implements IContatosDoSiteAdapter {
  private readonly obterToken: () => Promise<string | null>;
  private readonly fetchFn: typeof fetch;

  constructor(obterToken: () => Promise<string | null>, fetchFn: typeof fetch = (...args) => fetch(...args)) {
    this.obterToken = obterToken;
    this.fetchFn = fetchFn;
  }

  async listar(): Promise<PaginaDeContatos> {
    const corpo = (await this.pedir(ROTA)) as { contatos: ContatoDoWorker[]; haMais: boolean };
    return { contatos: corpo.contatos.map(paraContato), haMais: corpo.haMais };
  }

  private async pedir(caminho: string, init: RequestInit = {}): Promise<unknown> {
    const token = await this.obterToken();
    if (!token) throw new ContatosDoSiteError('nao-autenticado');

    let res: Response;
    try {
      res = await this.fetchFn(caminho, {
        ...init,
        headers: { ...init.headers, authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      });
    } catch {
      throw new ContatosDoSiteError('falha');
    }

    if (res.status === 401) throw new ContatosDoSiteError('nao-autenticado');
    if (res.status === 403) throw new ContatosDoSiteError('sem-permissao');
    if (!res.ok) throw new ContatosDoSiteError('falha');
    return res.json();
  }
}
