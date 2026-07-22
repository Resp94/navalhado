import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/Toast';
import { ClienteConstraintError, ClienteRepository, ClienteValidationError } from './ClienteRepository';
import { SupabaseClienteAdapter } from './adapters/SupabaseClienteAdapter';
import type { Cliente, ClienteInputData, EstatisticasCliente, HistoricoVisitasCliente, StatusFiltroCliente } from './types';

export function filterClientes(customers: Cliente[], searchTerm: string, filterStatus: StatusFiltroCliente): Cliente[] {
  const term = searchTerm.toLowerCase().trim();

  return customers.filter((customer) => {
    const matchesSearch =
      !term ||
      customer.name.toLowerCase().includes(term) ||
      customer.phone.includes(term) ||
      (customer.email && customer.email.toLowerCase().includes(term));

    if (!matchesSearch) return false;

    if (filterStatus === 'completos') return customer.cadastro_completo;
    if (filterStatus === 'provisorios') return !customer.cadastro_completo;

    return true;
  });
}

export function calculateClienteStats(customers: Cliente[]): EstatisticasCliente {
  const totalCount = customers.length;
  const completosCount = customers.filter((c) => c.cadastro_completo).length;
  const provisoriosCount = customers.filter((c) => !c.cadastro_completo).length;

  return { totalCount, completosCount, provisoriosCount };
}

export function useClientes(tenantId: string) {
  const { addToast } = useToast();

  const repository = useMemo(() => {
    const adapter = new SupabaseClienteAdapter(supabase);
    return new ClienteRepository(adapter);
  }, []);

  const [customers, setCustomers] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<StatusFiltroCliente>('todos');

  // Gaveta lateral de histórico
  const [history, setHistory] = useState<HistoricoVisitasCliente[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const loadCustomers = useCallback(async () => {
    if (!tenantId) return;
    try {
      setLoading(true);
      const list = await repository.listByTenant(tenantId);
      setCustomers(list);
    } catch (error: any) {
      console.error('Erro ao carregar clientes:', error);
      addToast('Não foi possível carregar a lista de clientes.', 'error');
    } finally {
      setLoading(false);
    }
  }, [tenantId, repository, addToast]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const filteredCustomers = useMemo(() => {
    return filterClientes(customers, searchTerm, filterStatus);
  }, [customers, searchTerm, filterStatus]);

  const stats: EstatisticasCliente = useMemo(() => {
    return calculateClienteStats(customers);
  }, [customers]);

  const saveCustomer = async (input: ClienteInputData): Promise<boolean> => {
    try {
      await repository.saveCustomer(tenantId, input);
      addToast(
        input.id ? 'Cliente atualizado com sucesso!' : 'Novo cliente cadastrado com sucesso!',
        'success'
      );
      await loadCustomers();
      return true;
    } catch (error: any) {
      if (error instanceof ClienteValidationError) {
        addToast(error.message, 'warning');
      } else {
        console.error('Erro ao salvar cliente:', error);
        addToast('Erro ao salvar informações do cliente.', 'error');
      }
      return false;
    }
  };

  const deleteCustomer = async (customerId: string): Promise<boolean> => {
    try {
      await repository.deleteCustomer(tenantId, customerId);
      addToast('Cliente excluído com sucesso!', 'success');
      await loadCustomers();
      return true;
    } catch (error: any) {
      console.error('Erro ao excluir cliente:', error);
      if (error instanceof ClienteConstraintError) {
        addToast(error.message, 'error');
      } else {
        addToast('Erro ao excluir o cliente.', 'error');
      }
      return false;
    }
  };

  const loadHistorico = async (customerId: string) => {
    try {
      setHistory([]);
      const data = await repository.getHistoricoVisitas(customerId);
      setHistory(data);
    } catch (error: any) {
      console.error('Erro ao carregar histórico:', error);
      addToast('Erro ao carregar histórico de visitas.', 'error');
    }
  };

  return {
    customers,
    filteredCustomers,
    stats,
    loading,
    searchTerm,
    setSearchTerm,
    filterStatus,
    setFilterStatus,
    history,
    loadingHistory,
    saveCustomer,
    deleteCustomer,
    loadHistorico,
    reload: loadCustomers,
  };
}
