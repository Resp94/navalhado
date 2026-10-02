import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CadastroBarbearia } from '../CadastroBarbearia';
import { POLITICA_DE_PRIVACIDADE, TERMOS_DE_USO, VERSAO_ATUAL_DOS_TERMOS } from '../../modules/termos/textos';

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

// Spec 052, ticket 16: o cadastro exige marcar o aceite dos Termos de Uso e da Política de Privacidade.
const aceitarOsTermos = () => fireEvent.click(screen.getByRole('checkbox', { name: /Li e aceito/ }));

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
    aceitarOsTermos();
    const submitButton = screen.getByRole('button', { name: 'Criar conta' });
    await waitFor(() => expect(submitButton).toBeEnabled());
    fireEvent.click(submitButton);

    // Sem escolher nada, o plano do meio (Máquina) já vem selecionado. O aceite vai como a versão dos termos (o banco grava a
    // versão e a data); a autoridade, o plano e a barbearia continuam sendo decididos no servidor.
    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith({
        email: 'gestor@segura.test',
        password: 'SenhaForte123!',
        options: {
          data: {
            name: 'Gestor Seguro',
            terms_version: VERSAO_ATUAL_DOS_TERMOS,
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
    aceitarOsTermos();

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
    aceitarOsTermos();
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

  // Spec 052, ticket 16: o cadastro exige marcar "Li e aceito" e manda a versão dos termos aceita; o banco grava a versão e a data.
  describe('aceite dos Termos de Uso', () => {
    it('começa sem aceitar, e "Criar conta" fica travado até marcar o aceite', async () => {
      render(<CadastroBarbearia />);
      await avancarParaEtapaDoGestor();
      await screen.findByText('Tesoura');

      expect(screen.getByRole('checkbox', { name: /Li e aceito/ })).not.toBeChecked();
      expect(screen.getByRole('button', { name: 'Criar conta' })).toBeDisabled();

      aceitarOsTermos();
      await waitFor(() => expect(screen.getByRole('button', { name: 'Criar conta' })).toBeEnabled());
    });

    it('desmarcar o aceite trava "Criar conta" de novo', async () => {
      render(<CadastroBarbearia />);
      await avancarParaEtapaDoGestor();
      await screen.findByText('Tesoura');

      aceitarOsTermos();
      await waitFor(() => expect(screen.getByRole('button', { name: 'Criar conta' })).toBeEnabled());
      aceitarOsTermos();

      expect(screen.getByRole('button', { name: 'Criar conta' })).toBeDisabled();
    });

    it('não envia o cadastro sem o aceite, mesmo com o formulário enviado fora do botão', async () => {
      render(<CadastroBarbearia />);
      await avancarParaEtapaDoGestor();
      await screen.findByText('Tesoura');

      fireEvent.submit(screen.getByRole('button', { name: 'Criar conta' }).closest('form') as HTMLFormElement);

      expect(mockSignUp).not.toHaveBeenCalled();
      expect(mockAddToast).toHaveBeenCalledWith(expect.stringMatching(/Termos de Uso/), 'warning');
    });

    it('os links do aceite abrem os Termos de Uso e a Política de Privacidade da plataforma, sem marcar o aceite', async () => {
      render(<CadastroBarbearia />);
      await avancarParaEtapaDoGestor();

      fireEvent.click(screen.getByRole('button', { name: 'Termos de Uso' }));
      expect(screen.getByRole('heading', { name: TERMOS_DE_USO.titulo })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: TERMOS_DE_USO.secoes[2].titulo })).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));

      fireEvent.click(screen.getByRole('button', { name: 'Política de Privacidade' }));
      expect(screen.getByRole('heading', { name: POLITICA_DE_PRIVACIDADE.titulo })).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));

      expect(screen.getByRole('checkbox', { name: /Li e aceito/ })).not.toBeChecked();
    });

    it('os links do rodapé também abrem os textos da plataforma, com as cláusulas da assinatura', () => {
      render(<CadastroBarbearia />);

      fireEvent.click(screen.getByRole('button', { name: 'Termos de uso' }));
      expect(screen.getByRole('heading', { name: TERMOS_DE_USO.titulo })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: '3. Preço e renovação mensal automática' })).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));

      fireEvent.click(screen.getByRole('button', { name: 'Privacidade (LGPD)' }));
      expect(screen.getByRole('heading', { name: POLITICA_DE_PRIVACIDADE.titulo })).toBeInTheDocument();
    });
  });

  it('avisa e nao deixa criar a conta quando o catalogo de planos nao carrega (spec 052, ticket 01)', async () => {
    mockCatalogo({ data: null, error: { message: 'falha de rede' } });

    render(<CadastroBarbearia />);
    await avancarParaEtapaDoGestor();
    // Com o aceite marcado, o catálogo que não carregou é a única razão de o botão estar desligado (sem ele, o aceite também o desligaria).
    aceitarOsTermos();

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
