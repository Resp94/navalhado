import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CadastroBarbearia } from '../CadastroBarbearia';

const { mockAddToast, mockNavigate, mockFrom, mockSignUp } = vi.hoisted(() => ({
  mockAddToast: vi.fn(),
  mockNavigate: vi.fn(),
  mockFrom: vi.fn(),
  mockSignUp: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('../../components/Toast', () => ({
  useToast: () => ({ addToast: mockAddToast }),
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      signUp: mockSignUp,
    },
    from: mockFrom,
  },
}));

const dnsResponse = (status: number, answers: { type: number; data: string }[] = []) => ({
  ok: true,
  json: async () => ({
    Status: status,
    Answer: answers.map((a) => ({ name: 'x', type: a.type, TTL: 300, data: a.data })),
  }),
});

// Catálogo como o banco devolve (spec 052, ticket 01): preço numérico e limite de profissionais.
const PLANOS_DO_BANCO = [
  { id: 'plano-tesoura', name: 'Tesoura', price: 59.9, max_professionals: 1 },
  { id: 'plano-maquina', name: 'Máquina', price: 89.9, max_professionals: 5 },
  { id: 'plano-bancada', name: 'Bancada', price: 159.9, max_professionals: 10 },
];

const mockCatalogo = (resultado: { data: unknown; error: unknown }) => {
  const order = vi.fn().mockResolvedValue(resultado);
  const select = vi.fn().mockReturnValue({ order });
  mockFrom.mockReturnValue({ select });
};

const avancarParaEtapaDoGestor = async () => {
  fireEvent.change(screen.getByPlaceholderText('Ex: Barbearia Estilo'), { target: { value: 'Barbearia Segura' } });
  fireEvent.change(screen.getByPlaceholderText('comercial@suabarbearia.com'), { target: { value: 'contato@segura.test' } });
  fireEvent.change(screen.getByPlaceholderText('(99) 99999-9999'), { target: { value: '92999999999' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));

  // nextStep aguarda a checagem de domínio (spec 047, ticket 07) antes de avançar.
  fireEvent.change(await screen.findByPlaceholderText('Seu nome'), { target: { value: 'Gestor Seguro' } });
  fireEvent.change(screen.getByPlaceholderText('seu.login@email.com'), { target: { value: 'gestor@segura.test' } });
  fireEvent.change(screen.getByPlaceholderText('Mínimo 8 caracteres'), { target: { value: 'SenhaForte123!' } });
};

describe('CadastroBarbearia', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    mockCatalogo({ data: PLANOS_DO_BANCO, error: null });
    mockSignUp.mockResolvedValue({
      data: { session: { access_token: 'token' } },
      error: null,
    });
    // Padrão: qualquer domínio consultado tem MX (spec 047, ticket 07). Testes
    // específicos de domínio/sugestão sobrescrevem este mock.
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      dnsResponse(0, [{ type: 15, data: '10 mail.exemplo.' }]) as any
    );
  });

  it('cria o usuario sem metadados de autoridade e finaliza o tenant no servidor', async () => {
    render(<CadastroBarbearia />);

    await avancarParaEtapaDoGestor();
    const submitButton = screen.getByRole('button', { name: 'Criar conta' });
    await waitFor(() => expect(submitButton).toBeEnabled());
    fireEvent.click(submitButton);

    // Sem escolher nada, o plano do meio (Máquina) já vem selecionado.
    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith({
        email: 'gestor@segura.test',
        password: 'SenhaForte123!',
        options: {
          data: {
            name: 'Gestor Seguro',
            tenant_signup: {
              name: 'Barbearia Segura',
              email: 'contato@segura.test',
              phone: '92999999999',
              plan_id: 'plano-maquina',
            },
          },
        },
      });
    });

    // O único acesso direto a tabela é a leitura do catálogo de planos.
    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(mockFrom).toHaveBeenCalledWith('plans');
  });

  it('pre-seleciona o unico plano quando o catalogo tem um so (spec 052, ticket 01)', async () => {
    mockCatalogo({ data: [PLANOS_DO_BANCO[0]], error: null });

    render(<CadastroBarbearia />);
    await avancarParaEtapaDoGestor();

    const submitButton = screen.getByRole('button', { name: 'Criar conta' });
    await waitFor(() => expect(submitButton).toBeEnabled());
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith(
        expect.objectContaining({
          options: {
            data: expect.objectContaining({
              tenant_signup: expect.objectContaining({ plan_id: 'plano-tesoura' }),
            }),
          },
        })
      );
    });
  });

  it('nao envia o cadastro sem catalogo carregado, mesmo com o formulario enviado fora do botao (spec 052, ticket 01)', async () => {
    mockCatalogo({ data: null, error: { message: 'falha de rede' } });

    render(<CadastroBarbearia />);
    await avancarParaEtapaDoGestor();
    await screen.findByText(/Não foi possível carregar os planos/i);

    fireEvent.submit(screen.getByRole('button', { name: 'Criar conta' }).closest('form') as HTMLFormElement);

    expect(mockSignUp).not.toHaveBeenCalled();
    expect(mockAddToast).toHaveBeenCalledWith(expect.stringMatching(/planos/i), 'warning');
  });

  it('mostra os planos do banco com preço e limite de profissionais (spec 052, ticket 01)', async () => {
    render(<CadastroBarbearia />);
    await avancarParaEtapaDoGestor();

    expect(await screen.findByText('Tesoura')).toBeInTheDocument();
    expect(screen.getByText('59,90')).toBeInTheDocument();
    expect(screen.getByText('1 profissional')).toBeInTheDocument();

    expect(screen.getByText('Máquina')).toBeInTheDocument();
    expect(screen.getByText('89,90')).toBeInTheDocument();
    expect(screen.getByText('Até 5 profissionais')).toBeInTheDocument();

    expect(screen.getByText('Bancada')).toBeInTheDocument();
    expect(screen.getByText('159,90')).toBeInTheDocument();
    expect(screen.getByText('Até 10 profissionais')).toBeInTheDocument();

    expect(screen.queryByText('Bronze')).not.toBeInTheDocument();
    expect(screen.queryByText('Prata')).not.toBeInTheDocument();
    expect(screen.queryByText('Ouro')).not.toBeInTheDocument();
  });

  it('envia o id do plano escolhido no cadastro (spec 052, ticket 01)', async () => {
    render(<CadastroBarbearia />);
    await avancarParaEtapaDoGestor();

    fireEvent.click(await screen.findByText('Bancada'));
    const submitButton = screen.getByRole('button', { name: 'Criar conta' });
    await waitFor(() => expect(submitButton).toBeEnabled());
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith(
        expect.objectContaining({
          options: {
            data: expect.objectContaining({
              tenant_signup: expect.objectContaining({ plan_id: 'plano-bancada' }),
            }),
          },
        })
      );
    });
  });

  it('avisa e nao deixa criar a conta quando o catalogo de planos nao carrega (spec 052, ticket 01)', async () => {
    mockCatalogo({ data: null, error: { message: 'falha de rede' } });

    render(<CadastroBarbearia />);
    await avancarParaEtapaDoGestor();

    expect(await screen.findByText(/Não foi possível carregar os planos/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Criar conta' })).toBeDisabled();
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('recusa e-mail comercial com TLD de 1 letra (regra mais rígida da spec 047) e mantém "Continuar" desabilitado', async () => {
    render(<CadastroBarbearia />);

    fireEvent.change(screen.getByPlaceholderText('Ex: Barbearia Estilo'), { target: { value: 'Barbearia Segura' } });
    fireEvent.change(screen.getByPlaceholderText('comercial@suabarbearia.com'), { target: { value: 'contato@segura.x' } });
    fireEvent.change(screen.getByPlaceholderText('(99) 99999-9999'), { target: { value: '92999999999' } });

    await waitFor(() => expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('recusa avançar com e-mail comercial de domínio que não recebe e-mails (spec 047, ticket 07)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(dnsResponse(3) as any); // NXDOMAIN

    render(<CadastroBarbearia />);

    fireEvent.change(screen.getByPlaceholderText('Ex: Barbearia Estilo'), { target: { value: 'Barbearia Segura' } });
    fireEvent.change(screen.getByPlaceholderText('comercial@suabarbearia.com'), {
      target: { value: 'contato@dominio-inventado-cadastro.example' },
    });
    fireEvent.change(screen.getByPlaceholderText('(99) 99999-9999'), { target: { value: '92999999999' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith('Corrija os erros antes de continuar.', 'warning');
    });
    expect(screen.getByPlaceholderText('Ex: Barbearia Estilo')).toBeInTheDocument(); // continua na etapa 1
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('sugere a correção do e-mail de acesso do gestor e aplica ao clicar (spec 047, ticket 07)', async () => {
    render(<CadastroBarbearia />);

    fireEvent.change(screen.getByPlaceholderText('Ex: Barbearia Estilo'), { target: { value: 'Barbearia Segura' } });
    fireEvent.change(screen.getByPlaceholderText('comercial@suabarbearia.com'), { target: { value: 'contato@segura.test' } });
    fireEvent.change(screen.getByPlaceholderText('(99) 99999-9999'), { target: { value: '92999999999' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));

    const inputGestorEmail = await screen.findByPlaceholderText('seu.login@email.com') as HTMLInputElement;
    fireEvent.change(inputGestorEmail, { target: { value: 'gestor@gmial.com' } });

    const btnSugestao = await screen.findByRole('button', { name: /gestor@gmail\.com/i });
    fireEvent.click(btnSugestao);

    expect(inputGestorEmail.value).toBe('gestor@gmail.com');
  });
});
