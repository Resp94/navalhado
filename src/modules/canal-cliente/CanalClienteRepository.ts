import {
  CanalClienteTokenError,
  CanalClienteValidationError,
} from './errors';
import type {
  AgendamentoCanal,
  ContextoPublicoCanal,
  DadosSessaoPublica,
  HorarioGradeCanal,
  IdentidadeClientePublica,
  ICanalClienteAdapter,
  ConfirmacaoAgendamentoPublico,
  InputConfirmarAgendamentoPublico,
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

  async obterContextoPublico(slug: string): Promise<ContextoPublicoCanal | null> {
    if (!slug || !slug.trim()) {
      throw new CanalClienteValidationError('Slug do estabelecimento não informado.');
    }

    return await this.adapter.buscarContextoPublicoPorSlug(slug.trim());
  }

  async resolverIdentidadePublica(
    slug: string,
    name: string,
    phone: string
  ): Promise<IdentidadeClientePublica | null> {
    if (!slug || !slug.trim()) {
      throw new CanalClienteValidationError('Slug do estabelecimento não informado.');
    }
    if (!name || name.trim().split(/\s+/).filter(Boolean).length < 2) {
      throw new CanalClienteValidationError('Informe nome e sobrenome completos.');
    }
    const normalizedPhone = phone.replace(/\D/g, '');
    if (normalizedPhone.length < 10 || normalizedPhone.length > 13) {
      throw new CanalClienteValidationError('Informe um WhatsApp válido com DDD.');
    }

    return await this.adapter.buscarIdentidadePublica(
      slug.trim(),
      name.trim(),
      normalizedPhone,
    );
  }

  async iniciarSessaoPublica(
    slug: string,
    name: string,
    phone: string,
    captchaToken?: string,
  ): Promise<DadosSessaoPublica | null> {
    if (!slug || !slug.trim()) {
      throw new CanalClienteValidationError('Slug do estabelecimento não informado.');
    }
    if (!name || name.trim().split(/\s+/).filter(Boolean).length < 2) {
      throw new CanalClienteValidationError('Informe nome e sobrenome completos.');
    }
    const normalizedPhone = phone.replace(/\D/g, '');
    if (normalizedPhone.length < 10 || normalizedPhone.length > 13) {
      throw new CanalClienteValidationError('Informe um WhatsApp válido com DDD.');
    }

    return await this.adapter.iniciarSessaoPublica(slug.trim(), name.trim(), normalizedPhone, captchaToken);
  }

  async obterPerfilPublicoSessao(): Promise<PerfilClienteCanal | null> {
    return await this.adapter.obterPerfilPublicoSessao();
  }

  async encerrarSessaoPublica(): Promise<void> {
    await this.adapter.encerrarSessaoPublica();
  }

  async obterAgendamentosPublicoSessao(): Promise<AgendamentoCanal[]> {
    return await this.adapter.listarAgendamentosPublicoSessao();
  }

  async cancelarAgendamentoPublicoSessao(appointmentId: string, motivo?: string): Promise<void> {
    if (!appointmentId?.trim()) {
      throw new CanalClienteValidationError('ID do agendamento é obrigatório para cancelamento.');
    }
    await this.adapter.cancelarAgendamentoPublicoSessao(appointmentId.trim(), motivo);
  }

  async reagendarAgendamentoPublicoSessao(input: InputReagendarAgendamento): Promise<void> {
    if (!input.appointmentId?.trim()) {
      throw new CanalClienteValidationError('ID do agendamento é obrigatório para reagendamento.');
    }
    if (!input.newStartTime && (!input.newDate || !input.newSlot)) {
      throw new CanalClienteValidationError('Selecione o novo horário do agendamento.');
    }
    await this.adapter.reagendarAgendamentoPublicoSessao(input);
  }

  async obterCatalogoServicosPublico(slug: string): Promise<{
    servicos: ServicoCanal[];
    categorias: string[];
  }> {
    if (!slug || !slug.trim()) {
      throw new CanalClienteValidationError('Slug do estabelecimento não informado.');
    }

    const servicos = await this.adapter.listarServicosPorSlug(slug.trim());
    const ativos = servicos.filter((s) => s.is_active !== false);
    const seen = new Set<string>();
    const categorias: string[] = [];
    const servicosNormalizados = ativos.map((service) => {
      const category = service.category?.trim()
        ? service.category.trim().charAt(0).toUpperCase() + service.category.trim().slice(1).toLowerCase()
        : 'Outro';
      if (!seen.has(category)) {
        seen.add(category);
        categorias.push(category);
      }
      return { ...service, category };
    });

    return { servicos: servicosNormalizados, categorias };
  }

  async obterProfissionaisPublicos(slug: string, serviceId: string): Promise<ProfissionalCanal[]> {
    if (!slug || !slug.trim()) {
      throw new CanalClienteValidationError('Slug do estabelecimento não informado.');
    }
    if (!serviceId || !serviceId.trim()) {
      throw new CanalClienteValidationError('O serviço é obrigatório para listar profissionais.');
    }

    const profissionais = await this.adapter.listarProfissionaisPorSlug(slug.trim(), serviceId.trim());
    return profissionais
      .filter((professional) => professional.is_active !== false)
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }

  async consultarGradeHorariosPublica(
    slug: string,
    dataStr: string,
    serviceId: string,
    professionalId?: string | null
  ): Promise<HorarioGradeCanal[]> {
    if (!slug || !slug.trim()) {
      throw new CanalClienteValidationError('Slug do estabelecimento não informado.');
    }
    if (!dataStr || !dataStr.trim()) {
      throw new CanalClienteValidationError('A data da consulta é obrigatória.');
    }
    if (!serviceId || !serviceId.trim()) {
      throw new CanalClienteValidationError('O serviço é obrigatório para consultar horários.');
    }

    return await this.adapter.buscarGradeHorariosPorSlug(
      slug.trim(),
      dataStr.trim(),
      serviceId.trim(),
      professionalId
    );
  }

  async confirmarAgendamentoPublico(
    input: InputConfirmarAgendamentoPublico
  ): Promise<ConfirmacaoAgendamentoPublico> {
    if (!input.slug?.trim()) {
      throw new CanalClienteValidationError('Slug do estabelecimento não informado.');
    }
    if (!input.serviceId?.trim()) {
      throw new CanalClienteValidationError('Selecione um serviço para agendar.');
    }
    if (!input.date?.trim() || !input.slot?.trim()) {
      throw new CanalClienteValidationError('Selecione a data e o horário do agendamento.');
    }
    if (!input.name?.trim()) {
      throw new CanalClienteValidationError('O nome é obrigatório para agendar.');
    }
    if (!input.phone?.trim()) {
      throw new CanalClienteValidationError('O telefone é obrigatório para agendar.');
    }

    return await this.adapter.confirmarAgendamentoPublico({
      ...input,
      slug: input.slug.trim(),
      token: input.token?.trim() || null,
      serviceId: input.serviceId.trim(),
      date: input.date.trim(),
      slot: input.slot.trim(),
      name: input.name.trim(),
      phone: input.phone.trim(),
    });
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
    tokenParam?: string | null,
    excludeAppointmentId?: string | null
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
      professionalId,
      excludeAppointmentId
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

  async consultarClientePorTelefone(
    telefone: string,
    tokenParam?: string | null
  ): Promise<{ found: boolean; customer_id?: string; customer_name?: string; customer_phone?: string; cadastro_completo?: boolean } | null> {
    if (!telefone || !telefone.trim()) return null;
    const token = this.resolverToken(tokenParam);
    return await this.adapter.buscarClientePorTelefone(token, telefone.trim());
  }
}
