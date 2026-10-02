import type { ITermosAdapter } from '../types';

/** Os aceites de um usuário só: o banco filtra por quem está logado (RLS), o adaptador em memória é esse usuário. */
export class InMemoryTermosAdapter implements ITermosAdapter {
  private readonly aceitas: Set<string>;

  constructor(versoesAceitas: string[] = []) {
    this.aceitas = new Set(versoesAceitas);
  }

  async jaAceitou(versao: string): Promise<boolean> {
    return this.aceitas.has(versao);
  }

  async aceitar(versao: string): Promise<void> {
    this.aceitas.add(versao);
  }
}
