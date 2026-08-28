import { describe, it, expect, beforeEach } from 'vitest';
import { CanalClienteRepository } from '../CanalClienteRepository';
import { InMemoryCanalClienteAdapter } from '../adapters/InMemoryCanalClienteAdapter';
import {
  CanalClienteTokenError,
  CanalClienteValidationError,
  AgendamentoConflitoError,
  AgendamentoRegraCancelamentoError,
} from '../errors';

describe('CanalClienteRepository', () => {
  let adapter: InMemoryCanalClienteAdapter;
  let repository: CanalClienteRepository;
  const validToken = 'token_valido_123';

  beforeEach(() => {
    adapter = new InMemoryCanalClienteAdapter();
    repository = new CanalClienteRepository(adapter);

    adapter.perfis.set(validToken, {
      customer_id: 'cust_1',
      customer_name: 'Jonathas Teste',
      tenant_id: 'tenant_1',
      tenant_name: 'Barbearia Navalhado',
      tenant_phone: '11999999999',
      cadastro_completo: true,
    });

    adapter.servicos = [
      {
        id: 's1',
        name: 'Corte de Cabelo',
        description: 'Corte social ou moderno',
        price: 45,
        duration_minutes: 30,
        category: 'Cabelo',
        is_active: true,
      },
      {
        id: 's2',
        name: 'Barba Completa',
        description: 'Toalha quente e lâmina',
        price: 35,
        duration_minutes: 25,
        category: 'Barba',
        is_active: true,
      },
    ];

    adapter.profissionais = [
      { id: 'p1', name: 'Mestre Barbeiro', is_active: true },
    ];

    adapter.contextosPublicos.set('brooklyn', {
      tenant_id: 'tenant_brooklyn',
      tenant_name: 'Barbearia brooklyn',
      tenant_phone: '11999999999',
      tenant_slug: 'brooklyn',
      timezone: 'America/Sao_Paulo',
      slot_interval_minutes: 30,
      min_booking_lead_time_minutes: 15,
      min_cancellation_lead_time_minutes: 120,
    });
  });

  it('deve lançar CanalClienteTokenError quando nenhum token estiver disponível', async () => {
    await expect(repository.obterPerfil()).rejects.toThrow(CanalClienteTokenError);
  });

  it('deve obter o perfil do cliente quando um token válido for fornecido', async () => {
    const perfil = await repository.obterPerfil(validToken);
    expect(perfil.customer_name).toBe('Jonathas Teste');
    expect(perfil.tenant_name).toBe('Barbearia Navalhado');
  });

  it('deve agrupar serviços por categoria respeitando a ordem de aparição estratégica', async () => {
    repository.definirTokenAcesso(validToken);
    const { servicos, categorias } = await repository.obterCatalogoServicos();

    expect(servicos).toHaveLength(2);
    expect(categorias).toEqual(['Cabelo', 'Barba']);
  });

  it('deve inicializar cliente e perfil a partir do slug do estabelecimento', async () => {
    const res = await repository.inicializarPorSlug('brooklyn');
    expect(res.token).toBe('token_brooklyn');
    expect(res.perfil.tenant_slug).toBe('brooklyn');
    expect(repository.obterTokenAcesso()).toBe('token_brooklyn');
  });

  it('deve resolver o contexto público sem criar cliente ou token', async () => {
    const contexto = await repository.obterContextoPublico('brooklyn');

    expect(contexto).toEqual({
      tenant_id: 'tenant_brooklyn',
      tenant_name: 'Barbearia brooklyn',
      tenant_phone: '11999999999',
      tenant_slug: 'brooklyn',
      timezone: 'America/Sao_Paulo',
      business_hours: undefined,
      slot_interval_minutes: 30,
      min_booking_lead_time_minutes: 15,
      min_cancellation_lead_time_minutes: 120,
    });
    expect(repository.obterTokenAcesso()).toBeNull();
    expect(adapter.perfis.size).toBe(1);
  });

  it('deve retornar nulo para slug público inexistente sem tocar no token', async () => {
    repository.definirTokenAcesso(validToken);

    await expect(repository.obterContextoPublico('inexistente')).resolves.toBeNull();
    expect(repository.obterTokenAcesso()).toBe(validToken);
    expect(adapter.perfis.size).toBe(1);
  });

  it('deve obter serviços e profissionais públicos sem exigir token', async () => {
    const catalogo = await repository.obterCatalogoServicosPublico('brooklyn');
    const profissionais = await repository.obterProfissionaisPublicos('brooklyn', 's1');

    expect(catalogo.servicos).toHaveLength(2);
    expect(catalogo.categorias).toEqual(['Cabelo', 'Barba']);
    expect(profissionais.map((professional) => professional.id)).toEqual(['p1']);
    expect(repository.obterTokenAcesso()).toBeNull();
  });

  it('deve consultar a grade pública preservando horários indisponíveis', async () => {
    adapter.gradesPublicas.set('2026-07-25_s1_p1', [
      { slot_time: '09:00', available: true },
      { slot_time: '09:30', available: false },
    ]);

    await expect(
      repository.consultarGradeHorariosPublica('brooklyn', '2026-07-25', 's1', 'p1')
    ).resolves.toEqual([
      { slot_time: '09:00', available: true },
      { slot_time: '09:30', available: false },
    ]);
  });

  it('deve consultar horários disponíveis com parâmetros válidos', async () => {
    repository.definirTokenAcesso(validToken);
    const slots = await repository.consultarHorariosDisponiveis('2026-07-25', 's1', 'p1');
    expect(slots).toContain('09:00');
  });

  it('deve validar parâmetros ao consultar horários disponíveis', async () => {
    repository.definirTokenAcesso(validToken);
    await expect(repository.consultarHorariosDisponiveis('', 's1')).rejects.toThrow(
      CanalClienteValidationError
    );
    await expect(repository.consultarHorariosDisponiveis('2026-07-25', '')).rejects.toThrow(
      CanalClienteValidationError
    );
  });

  it('deve criar agendamento com sucesso', async () => {
    repository.definirTokenAcesso(validToken);
    const res = await repository.criarAgendamento({
      serviceId: 's1',
      professionalId: 'p1',
      startTime: '2026-07-25T10:00:00-03:00',
    });

    expect(res.appointmentId).toBeDefined();
  });

  it('deve detectar conflito ao agendar no mesmo horário', async () => {
    repository.definirTokenAcesso(validToken);
    await repository.criarAgendamento({
      serviceId: 's1',
      professionalId: 'p1',
      startTime: '2026-07-25T10:00:00-03:00',
    });

    await expect(
      repository.criarAgendamento({
        serviceId: 's1',
        professionalId: 'p1',
        startTime: '2026-07-25T10:00:00-03:00',
      })
    ).rejects.toThrow(AgendamentoConflitoError);
  });

  it('deve separar agendamentos ativos e histórico', async () => {
    repository.definirTokenAcesso(validToken);
    await repository.criarAgendamento({
      serviceId: 's1',
      professionalId: 'p1',
      startTime: '2026-07-25T10:00:00-03:00',
    });

    const { ativos, historico } = await repository.obterAgendamentosSeparados();
    expect(ativos).toHaveLength(1);
    expect(historico).toHaveLength(0);
  });

  it('deve cancelar agendamento com sucesso', async () => {
    repository.definirTokenAcesso(validToken);
    const { appointmentId } = await repository.criarAgendamento({
      serviceId: 's1',
      professionalId: 'p1',
      startTime: '2026-07-25T10:00:00-03:00',
    });

    await repository.cancelarAgendamento(appointmentId, 'Desistência');

    const { ativos, historico } = await repository.obterAgendamentosSeparados();
    expect(ativos).toHaveLength(0);
    expect(historico).toHaveLength(1);
    expect(historico[0].status).toBe('canceled');
  });

  it('deve proibir cancelamento duplo com AgendamentoRegraCancelamentoError', async () => {
    repository.definirTokenAcesso(validToken);
    const { appointmentId } = await repository.criarAgendamento({
      serviceId: 's1',
      professionalId: 'p1',
      startTime: '2026-07-25T10:00:00-03:00',
    });

    await repository.cancelarAgendamento(appointmentId);

    await expect(repository.cancelarAgendamento(appointmentId)).rejects.toThrow(
      AgendamentoRegraCancelamentoError
    );
  });

  it('deve incluir o telefone do profissional nos agendamentos para contato direto via WhatsApp', async () => {
    repository.definirTokenAcesso(validToken);
    await repository.criarAgendamento({
      serviceId: 's1',
      professionalId: 'p1',
      startTime: '2026-07-25T10:00:00-03:00',
    });

    const { ativos } = await repository.obterAgendamentosSeparados();
    expect(ativos[0].professional_phone).toBe('92999999999');
  });
});
