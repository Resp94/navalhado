import { describe, it, expect, beforeEach } from 'vitest';
import { ClienteRepository, ClienteValidationError } from '../ClienteRepository';
import { InMemoryClienteAdapter } from '../adapters/InMemoryClienteAdapter';
import type { Customer } from '../types';

describe('ClienteRepository', () => {
  let adapter: InMemoryClienteAdapter;
  let repo: ClienteRepository;
  const tenantId = 'tenant_123';

  const mockCustomers: Customer[] = [
    {
      id: 'c1',
      tenant_id: tenantId,
      name: 'Carlos Silva',
      phone: '11999998888',
      email: 'carlos@email.com',
      notes: null,
      cadastro_completo: true,
      token_acesso: 'token_1',
      created_at: '2026-01-01T00:00:00Z',
    },
    {
      id: 'c2',
      tenant_id: tenantId,
      name: 'Ana Souza',
      phone: '11988887777',
      email: null,
      notes: 'Cliente VIP',
      cadastro_completo: false, // Cliente Provisório
      token_acesso: 'token_2',
      created_at: '2026-01-02T00:00:00Z',
    },
  ];

  beforeEach(() => {
    adapter = new InMemoryClienteAdapter(mockCustomers);
    repo = new ClienteRepository(adapter);
  });

  it('deve listar clientes ordenados alfabeticamente por nome', async () => {
    const list = await repo.getCustomers(tenantId);
    expect(list.length).toBe(2);
    expect(list[0].name).toBe('Ana Souza');
    expect(list[1].name).toBe('Carlos Silva');
  });

  it('deve calcular estatísticas corretamente (total, completos, provisórios)', () => {
    const stats = repo.calculateStats(mockCustomers);
    expect(stats.totalCount).toBe(2);
    expect(stats.completosCount).toBe(1);
    expect(stats.provisoriosCount).toBe(1);
  });

  it('deve filtrar clientes por termo de busca e status de cadastro', () => {
    const searchResult = repo.filterCustomers(mockCustomers, 'Ana', 'todos');
    expect(searchResult.length).toBe(1);
    expect(searchResult[0].name).toBe('Ana Souza');

    const provisorioResult = repo.filterCustomers(mockCustomers, '', 'provisorios');
    expect(provisorioResult.length).toBe(1);
    expect(provisorioResult[0].id).toBe('c2');
  });

  it('deve lançar erro de validação ao tentar salvar cliente sem nome ou sem telefone', async () => {
    await expect(repo.saveCustomer(tenantId, { name: '', phone: '1199999' })).rejects.toThrow(ClienteValidationError);
    await expect(repo.saveCustomer(tenantId, { name: 'João', phone: '' })).rejects.toThrow(ClienteValidationError);
  });

  it('deve promover Cliente Provisório para Cliente Completo ao salvar', async () => {
    const updated = await repo.saveCustomer(tenantId, {
      id: 'c2',
      name: 'Ana Souza',
      phone: '11988887777',
      notes: 'Dados atualizados pelo gerente',
    });

    expect(updated.cadastro_completo).toBe(true);
    expect(updated.notes).toBe('Dados atualizados pelo gerente');
  });

  it('deve excluir um cliente com sucesso', async () => {
    await repo.deleteCustomer(tenantId, 'c1');
    const remaining = await repo.getCustomers(tenantId);
    expect(remaining.length).toBe(1);
    expect(remaining[0].id).toBe('c2');
  });
});
