import {
  CanalClienteTokenError,
  CanalClienteValidationError,
} from './errors';
import type {
  AgendamentoCanal,
  ICanalClienteAdapter,
  InputCriarAgendamento,
  InputPromoverCadastroCliente,
  InputReagendarAgendamento,
  PerfilClienteCanal,
  ProfissionalCanal,
  ServicoCanal,
} from './types';

export class CanalClienteRepository {
  private adapter: ICanalClienteAdapter;

  constructor(adapter: ICanalClienteAdapter) {
    this.adapter = adapter;
  }

  private resolverToken(tokenExplicit?: string | null): string {
    if (tokenExplicit && tokenExplicit.trim()) {
      const cleanToken = tokenExplicit.trim();
      this.adapter.definirToken(cleanToken);
      return cleanToken;
    }

    const currentToken = this.adapter.obterTokenAtual();
    if (!currentToken || !currentToken.trim()) {
      throw new CanalClienteTokenError();
    }
    return currentToken.trim();
  }

  definirTokenAcesso(token: string): void {
    if (!token || !token.trim()) {
      throw new CanalClienteValidationError('Token de acesso não pode ser vazio.');
    }
    this.adapter.definirToken(token.trim());
  }

  obterTokenAcesso(): string | null {
    return this.adapter.obterTokenAtual();
  }

  limparTokenAcesso(): void {
    this.adapter.limparToken();
  }

  async obterPerfil(tokenParam?: string | null): Promise<PerfilClienteCanal> {
    const token = this.resolverToken(tokenParam);
    const perfil = await this.adapter.buscarPerfilPorToken(token);
    if (!perfil) {
      throw new CanalClienteTokenError();
    }
    return perfil;
  }

  async inicializarPorSlug(slug: string, existingToken?: string | null): Promise<{ token: string; perfil: PerfilClienteCanal }> {
    if (!slug || !slug.trim()) {
      throw new CanalClienteValidationError('Slug do estabelecimento não informado.');
    }
    const res = await this.adapter.inicializarPorSlug(slug.trim(), existingToken?.trim() || undefined);
    if (res.token) {
      this.adapter.definirToken(res.token);
    }
    return res;
  }

  async obterCatalogoServicos(tokenParam?: string | null): Promise<{
    servicos: ServicoCanal[];
    categorias: string[];
  }> {
    const token = this.resolverToken(tokenParam);
    const servicos = await this.adapter.listarServicosPorToken(token);
    const ativos = servicos.filter((s) => s.is_active !== false);

    // Ordenar categorias pela ordem de aparição dos serviços ordenados estrategicamente e normalizar nomes
    const seen = new Set<string>();
    const categoriasOrdenadas: string[] = [];
    const servicosNormalizados = ativos.map((s) => {
      const cat = (s.category && s.category.trim())
        ? s.category.trim().charAt(0).toUpperCase() + s.category.trim().slice(1).toLowerCase()
        : 'Outro';
      if (!seen.has(cat)) {
        seen.add(cat);
        categoriasOrdenadas.push(cat);
      }
      return {
        ...s,
        category: cat,
      };
    });

    return {
      servicos: servicosNormalizados,
      categorias: categoriasOrdenadas,
    };
  }

  async obterProfissionais(tokenParam?: string | null): Promise<ProfissionalCanal[]> {
    const token = this.resolverToken(tokenParam);
    const profissionais = await this.adapter.listarProfissionaisPorToken(token);
    return profissionais
      .filter((p) => p.is_active !== false)
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }

  async consultarHorariosDisponiveis(
    dataStr: string,
    serviceId: string,
    professionalId?: string | null,
    tokenParam?: string | null
  ): Promise<string[]> {
    const token = this.resolverToken(tokenParam);

    if (!dataStr || !dataStr.trim()) {
      throw new CanalClienteValidationError('A data da consulta é obrigatória.');
    }
    if (!serviceId || !serviceId.trim()) {
      throw new CanalClienteValidationError('O serviço é obrigatório para consultar horários.');
    }

    return await this.adapter.buscarHorariosDisponiveisPorToken(
      token,
      dataStr,
      serviceId,
      professionalId
    );
  }

  async criarAgendamento(
    input: InputCriarAgendamento,
    tokenParam?: string | null
  ): Promise<{ appointmentId: string }> {
    const token = this.resolverToken(tokenParam);

    if (!input.serviceId) {
      throw new CanalClienteValidationError('Selecione um serviço para agendar.');
    }
    if (!input.startTime) {
      throw new CanalClienteValidationError('Selecione o horário do agendamento.');
    }

    return await this.adapter.criarAgendamentoPorToken(token, input);
  }

  async reagendarAgendamento(
    input: InputReagendarAgendamento,
    tokenParam?: string | null
  ): Promise<void> {
    const token = this.resolverToken(tokenParam);

    if (!input.appointmentId) {
      throw new CanalClienteValidationError('ID do agendamento é obrigatório para reagendamento.');
    }
    if (!input.newStartTime) {
      throw new CanalClienteValidationError('Selecione o novo horário do agendamento.');
    }

    await this.adapter.reagendarAgendamentoPorToken(token, input);
  }

  async cancelarAgendamento(
    appointmentId: string,
    motivo?: string,
    tokenParam?: string | null
  ): Promise<void> {
    const token = this.resolverToken(tokenParam);

    if (!appointmentId) {
      throw new CanalClienteValidationError('ID do agendamento é obrigatório para cancelamento.');
    }

    await this.adapter.cancelarAgendamentoPorToken(token, appointmentId, motivo);
  }

  async obterAgendamentosSeparados(tokenParam?: string | null): Promise<{
    todos: AgendamentoCanal[];
    ativos: AgendamentoCanal[];
    historico: AgendamentoCanal[];
  }> {
    const token = this.resolverToken(tokenParam);
    const todos = await this.adapter.listarAgendamentosPorToken(token);

    const ativos = todos.filter(
      (a) => a.status !== 'canceled' && a.status !== 'completed'
    );
    const historico = todos.filter(
      (a) => a.status === 'canceled' || a.status === 'completed'
    );

    return { todos, ativos, historico };
  }

  async promoverCadastroCliente(
    input: InputPromoverCadastroCliente,
    tokenParam?: string | null
  ): Promise<PerfilClienteCanal | void> {
    const token = this.resolverToken(tokenParam);

    if (!input.name || !input.name.trim()) {
      throw new CanalClienteValidationError('O nome é obrigatório para concluir o cadastro.');
    }

    return await this.adapter.promoverCadastroPorToken(token, input);
  }

}
