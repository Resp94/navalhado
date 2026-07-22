import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/Toast';
import { ClienteRepository, ClienteValidationError } from './ClienteRepository';
import { SupabaseClienteAdapter } from './adapters/SupabaseClienteAdapter';
import type { Customer, CustomerAppointmentHistory, CustomerInputData, CustomerStats } from './types';

export function useClientes(tenantId: string) {
  const { addToast } = useToast();

  const repository = useMemo(() => {
    const adapter = new SupabaseClienteAdapter(supabase);
    return new ClienteRepository(adapter);
  }, []);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'todos' | 'completos' | 'provisorios'>('todos');

  // Gaveta lateral de histórico
  const [history, setHistory] = useState<CustomerAppointmentHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const loadCustomers = useCallback(async () => {
    if (!tenantId) return;
    try {
      setLoading(true);
      const list = await repository.getCustomers(tenantId);
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
    return repository.filterCustomers(customers, searchTerm, filterStatus);
  }, [repository, customers, searchTerm, filterStatus]);

  const stats: CustomerStats = useMemo(() => {
    return repository.calculateStats(customers);
  }, [repository, customers]);

  const saveCustomer = async (input: CustomerInputData): Promise<boolean> => {
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
      if (error?.code === '23503') {
        addToast('Este cliente não pode ser excluído porque possui agendamentos registrados no histórico.', 'error');
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
