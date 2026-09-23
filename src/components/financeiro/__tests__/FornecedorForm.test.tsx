import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FornecedorForm } from '../FornecedorForm';
import { PlanoContasRepository } from '../../../modules/plano-contas/PlanoContasRepository';
import { InMemoryPlanoContasAdapter } from '../../../modules/plano-contas/adapters/InMemoryPlanoContasAdapter';

// Spec 047, ticket 07: cobre só a checagem de domínio e a sugestão de
// correção adicionadas ao FornecedorForm. O resto do contrato (documento,
// conflito, categoria padrão) não tinha teste próprio antes desta spec.
describe('FornecedorForm (spec 047, ticket 07)', () => {
  const tenantId = 'tenant-1';
  let repository: PlanoContasRepository;
  const onSalvar = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();
    repository = new PlanoContasRepository(new InMemoryPlanoContasAdapter());
    onSalvar.mockClear();
  });

  const dnsResponse = (status: number, answers: { type: number; data: string }[] = []) => ({
    ok: true,
    json: async () => ({
      Status: status,
      Answer: answers.map((a) => ({ name: 'x', type: a.type, TTL: 300, data: a.data })),
    }),
  });

  it('recusa salvar com domínio de e-mail que não recebe e-mails e não chama onSalvar', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(dnsResponse(3) as any);

    render(
      <FornecedorForm repository={repository} tenantId={tenantId} categoriasAtivas={[]} onSalvar={onSalvar} />
    );

    fireEvent.change(screen.getByLabelText(/Nome do fornecedor/i), { target: { value: 'Fornecedor Teste' } });
    fireEvent.change(screen.getByLabelText(/E-mail/i), {
      target: { value: 'contato@dominio-inventado-fornecedor.example' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Cadastrar fornecedor/i }));

    await waitFor(() => {
      expect(screen.getByText('Este domínio não recebe e-mails.')).toBeInTheDocument();
    });
    expect(onSalvar).not.toHaveBeenCalled();
  });

  it('salva normalmente quando a consulta de domínio está indisponível', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('DNS fora do ar'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    render(
      <FornecedorForm repository={repository} tenantId={tenantId} categoriasAtivas={[]} onSalvar={onSalvar} />
    );

    fireEvent.change(screen.getByLabelText(/Nome do fornecedor/i), { target: { value: 'Fornecedor Indisponivel' } });
    fireEvent.change(screen.getByLabelText(/E-mail/i), {
      target: { value: 'contato@dominio-indisponivel-fornecedor.example' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Cadastrar fornecedor/i }));

    await waitFor(() => {
      expect(onSalvar).toHaveBeenCalled();
    });
  });

  it('sugere a correção de domínio digitado errado ao sair do campo', async () => {
    render(
      <FornecedorForm repository={repository} tenantId={tenantId} categoriasAtivas={[]} onSalvar={onSalvar} />
    );

    const inputEmail = screen.getByLabelText(/E-mail/i) as HTMLInputElement;
    fireEvent.change(inputEmail, { target: { value: 'contato@gmial.com' } });
    fireEvent.blur(inputEmail);

    const btnSugestao = await screen.findByRole('button', { name: /contato@gmail\.com/i });
    fireEvent.click(btnSugestao);

    expect(inputEmail.value).toBe('contato@gmail.com');
  });
});
