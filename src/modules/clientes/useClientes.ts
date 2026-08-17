import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/Toast';
import { ClienteConstraintError, ClienteRepository, ClienteValidationError } from './ClienteRepository';
import { SupabaseClienteAdapter } from './adapters/SupabaseClienteAdapter';
import type {
  Cliente,
  ClienteInputData,
  EstatisticasCliente,
  HistoricoVisitasCliente,
  ComandaHistoricoCliente,
  MetricasLTVCliente,
  StatusFiltroCliente,
} from './types';

export function filterClientes(
  customers: Cliente[],
  searchTerm: string,
  filterStatus: StatusFiltroCliente,
  tagFilter?: string | null
): Cliente[] {
  const term = searchTerm.toLowerCase().trim();

  return customers.filter((customer) => {
    const matchesSearch =
      !term ||
      customer.name.toLowerCase().includes(term) ||
      customer.phone.includes(term) ||
      (customer.email && customer.email.toLowerCase().includes(term)) ||
      (customer.cpf && customer.cpf.includes(term)) ||
      (customer.tags && customer.tags.some((t) => t.toLowerCase().includes(term)));

    if (!matchesSearch) return false;

    if (tagFilter && (!customer.tags || !customer.tags.includes(tagFilter))) {
      return false;
    }

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
  const [selectedTagFilter, setSelectedTagFilter] = useState<string | null>(null);

  // Gaveta lateral de histórico (Central 360)
  const [history, setHistory] = useState<HistoricoVisitasCliente[]>([]);
  const [comandasHistory, setComandasHistory] = useState<ComandaHistoricoCliente[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

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

  // Lista de todas as tags únicas existentes nos clientes da barbearia
  const allAvailableTags = useMemo(() => {
    const set = new Set<string>();
    customers.forEach((c) => {
      if (Array.isArray(c.tags)) {
        c.tags.forEach((t) => set.add(t));
      }
    });
    return Array.from(set).sort();
  }, [customers]);

  const filteredCustomers = useMemo(() => {
    return filterClientes(customers, searchTerm, filterStatus, selectedTagFilter);
  }, [customers, searchTerm, filterStatus, selectedTagFilter]);

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
      setLoadingDetails(true);
      setHistory([]);
      setComandasHistory([]);
      const [visitas, comandas] = await Promise.all([
        repository.getHistoricoVisitas(customerId),
        repository.getHistoricoComandas(tenantId, customerId),
      ]);
      setHistory(visitas);
      setComandasHistory(comandas);
    } catch (error: any) {
      console.error('Erro ao carregar histórico:', error);
      addToast('Erro ao carregar histórico de visitas e comandas.', 'error');
    } finally {
      setLoadingDetails(false);
    }
  };

  const calculateLTVMetrics = useCallback(
    (customerId: string): MetricasLTVCliente => {
      return repository.calculateLTV(customerId, history, comandasHistory);
    },
    [repository, history, comandasHistory]
  );

  return {
    customers,
    filteredCustomers,
    stats,
    loading,
    loadingDetails,
    searchTerm,
    setSearchTerm,
    filterStatus,
    setFilterStatus,
    selectedTagFilter,
    setSelectedTagFilter,
    allAvailableTags,
    history,
    comandasHistory,
    calculateLTVMetrics,
    saveCustomer,
    deleteCustomer,
    loadHistorico,
    reload: loadCustomers,
  };
}

