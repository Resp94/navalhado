import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Produtos } from '../Produtos';

// Mocks do GSAP para evitar erros no JSDOM
vi.mock('gsap', () => ({
  gsap: {
    fromTo: vi.fn(),
  },
}));

vi.mock('@gsap/react', () => ({
  useGSAP: (cb: () => void) => {
    cb();
  },
}));

// Mocks hoisted do Vitest
const { mockAddToast, mockListAll } = vi.hoisted(() => {
  const mockAddToast = vi.fn();
  const mockListAll = vi.fn();
  return { mockAddToast, mockListAll };
});

vi.mock('../../../components/Toast', () => ({
  useToast: () => ({
    addToast: mockAddToast,
  }),
}));

vi.mock('react-router-dom', () => ({
  useOutletContext: () => ({
    tenantId: 'tenant-test-id',
    tenantName: 'Barbearia Estilo',
  }),
  useNavigate: () => vi.fn(),
}));

vi.mock('../../../modules/produtos/adapters/SupabaseProdutoAdapter', () => ({
  SupabaseProdutoAdapter: class MockSupabaseProdutoAdapter {},
}));

vi.mock('../../../modules/produtos/ProdutoRepository', () => ({
  ProdutoRepository: class MockProdutoRepository {
    listAll = mockListAll;
    saveProduct = vi.fn();
    adjustStock = vi.fn();
    getMovements = vi.fn().mockResolvedValue([]);
  },
}));

describe('Página de Produtos (Produtos.tsx)', () => {
  const mockProducts = [
    {
      id: 'prod-1',
      tenant_id: 'tenant-test-id',
      name: 'Pomada Efeito Matte',
      brand: 'BarberBrand',
      category: 'Finalizadores',
      product_type: 'retail',
      unit_type: 'un',
      price: 45.0,
      cost_price: 20.0,
      stock_quantity: 12,
      min_stock_alert: 5,
      commission_percentage: 10,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'prod-2',
      tenant_id: 'tenant-test-id',
      name: 'Lâmina Descartável Platinum',
      brand: 'Wilkinson',
      category: 'Lâminas',
      product_type: 'internal_use',
      unit_type: 'cx',
      price: 0,
      cost_price: 15.0,
      stock_quantity: 2,
      min_stock_alert: 5,
      commission_percentage: null,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockListAll.mockResolvedValue(mockProducts);
  });

  it('deve renderizar os StatCards e a listagem de produtos com sucesso', async () => {
    render(<Produtos />);

    await waitFor(() => {
      expect(screen.getByText('Pomada Efeito Matte')).toBeInTheDocument();
    });

    // StatCards e badges
    expect(screen.getByText('Total no catálogo')).toBeInTheDocument();
    expect(screen.getAllByText('Venda no balcão').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Insumos de bancada')).toBeInTheDocument();
    expect(screen.getByText('Reposição necessária')).toBeInTheDocument();

    // Produtos na tabela
    expect(screen.getByText('BarberBrand')).toBeInTheDocument();
    expect(screen.getByText('Lâmina Descartável Platinum')).toBeInTheDocument();
    expect(screen.getByText('Wilkinson')).toBeInTheDocument();
  });

  it('deve filtrar produtos pela busca de texto', async () => {
    render(<Produtos />);

    await waitFor(() => {
      expect(screen.getByText('Pomada Efeito Matte')).toBeInTheDocument();
    });

    const searchInput = screen.getByLabelText('Buscar produtos por nome, marca ou categoria');
    fireEvent.change(searchInput, { target: { value: 'Wilkinson' } });

    expect(screen.queryByText('Pomada Efeito Matte')).not.toBeInTheDocument();
    expect(screen.getByText('Lâmina Descartável Platinum')).toBeInTheDocument();
  });

  it('deve abrir o modal de cadastro ao clicar em Novo produto', async () => {
    render(<Produtos />);

    await waitFor(() => {
      expect(screen.getByText('Pomada Efeito Matte')).toBeInTheDocument();
    });

    const newProductBtn = screen.getByRole('button', { name: /Novo produto/i });
    fireEvent.click(newProductBtn);

    expect(screen.getByText('Cadastrar novo produto')).toBeInTheDocument();
    expect(screen.getByLabelText(/Nome do produto \*/i)).toBeInTheDocument();
  });

  it('deve exibir EmptyState com ilustração e sem descrição quando não houver produtos cadastrados', async () => {
    mockListAll.mockResolvedValue([]);
    render(<Produtos />);

    await waitFor(() => {
      expect(screen.getByText('Nenhum produto encontrado')).toBeInTheDocument();
    });

    // A descrição do EmptyState não deve existir quando não há produtos
    expect(screen.queryByText('Nenhum produto encontrado para os filtros selecionados.')).not.toBeInTheDocument();

    // A ilustração SVG de caixa vazia deve estar presente
    const illustration = document.querySelector('.empty-box-illustration');
    expect(illustration).toBeInTheDocument();
  });
});
