import { render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { ToastProvider } from '../../Toast';

const { mockMaybeSingle } = vi.hoisted(() => ({ mockMaybeSingle: vi.fn() }));

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mockMaybeSingle }) }) }),
  },
}));

import { MobileMaisDrawer } from '../MobileMaisDrawer';

const renderizar = () =>
  render(
    <ToastProvider>
      <BrowserRouter>
        <MobileMaisDrawer
          isOpen
          onClose={vi.fn()}
          tenantId="tenant-123"
          tenantName="Barbearia Navalha"
          managerName="Lucas Gerente"
          onLogout={vi.fn()}
        />
      </BrowserRouter>
    </ToastProvider>,
  );

const atalhoDoWhatsapp = () => screen.getByRole('button', { name: /Robô WhatsApp/ });
const pontoDo = (atalho: HTMLElement) => atalho.querySelector('span.rounded-full') as HTMLElement;

// O atalho "Robô WhatsApp" do menu mostra o estado da Instância WhatsApp (CONTEXT.md: conectada, pareando, pausada ou desconectada).
// A sessão pausada ('hibernated') guarda as credenciais e não é uma falha: o ponto não é o vermelho do desconectado.
describe('MobileMaisDrawer - atalho do Robô WhatsApp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    { status: 'connected', texto: 'Conectado', aria: 'Conectado', ponto: 'bg-success' },
    { status: 'connecting', texto: 'Conectando...', aria: 'Conectando', ponto: 'bg-warning' },
    { status: 'hibernated', texto: 'Pausado', aria: 'Pausado', ponto: 'bg-text-secondary' },
    { status: 'disconnected', texto: 'Desconectado', aria: 'Desconectado', ponto: 'bg-error' },
  ])('com a instância $status mostra "$texto", o ponto $ponto e anuncia "$aria" ao leitor de tela', async ({ status, texto, aria, ponto }) => {
    mockMaybeSingle.mockResolvedValue({ data: { status }, error: null });
    renderizar();

    await waitFor(() => expect(within(atalhoDoWhatsapp()).getByText(texto)).toBeInTheDocument());
    expect(pontoDo(atalhoDoWhatsapp()).className).toContain(ponto);
    if (status !== 'disconnected') expect(pontoDo(atalhoDoWhatsapp()).className).not.toContain('bg-error');
    expect(screen.getByRole('button', { name: `Robô WhatsApp: ${aria}. Clique para gerenciar.` })).toBeInTheDocument();
  });

  it('sem instância (a barbearia ainda não criou) aparece desconectado', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    renderizar();

    await waitFor(() => expect(within(atalhoDoWhatsapp()).getByText('Desconectado')).toBeInTheDocument());
    expect(pontoDo(atalhoDoWhatsapp()).className).toContain('bg-error');
  });
});
