import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AgendamentoOnlineIndisponivel } from '../AgendamentoOnlineIndisponivel';

describe('AgendamentoOnlineIndisponivel', () => {
  describe('página inteira (quem tenta agendar)', () => {
    it('diz que o agendamento online está indisponível e cita a barbearia', () => {
      render(<AgendamentoOnlineIndisponivel tenantName="Barbearia Estilo" tenantPhone="5592999999999" />);

      expect(screen.getByRole('heading', { name: 'Agendamento online indisponível' })).toBeInTheDocument();
      expect(screen.getByText(/Barbearia Estilo não está recebendo agendamentos online no momento/i)).toBeInTheDocument();
    });

    it('oferece o contato direto pelo WhatsApp da barbearia', () => {
      render(<AgendamentoOnlineIndisponivel tenantName="Barbearia Estilo" tenantPhone="(55) 92 99999-9999" />);

      const link = screen.getByRole('link', { name: /falar com a barbearia pelo whatsapp/i });
      expect(link).toHaveAttribute('href', expect.stringContaining('wa.me/5592999999999'));
    });

    it('sem telefone da barbearia, não mostra link nenhum', () => {
      render(<AgendamentoOnlineIndisponivel tenantName="Barbearia Estilo" />);

      expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });

    it('sem o nome da barbearia, usa um texto genérico', () => {
      render(<AgendamentoOnlineIndisponivel />);

      expect(screen.getByText(/Esta barbearia não está recebendo agendamentos online/i)).toBeInTheDocument();
    });
  });

  describe('aviso (quem já tem horários marcados)', () => {
    it('avisa que ainda dá para cancelar os horários já marcados', () => {
      render(<AgendamentoOnlineIndisponivel variante="aviso" tenantName="Barbearia Estilo" />);

      expect(screen.getByRole('heading', { name: 'Agendamento online indisponível' })).toBeInTheDocument();
      expect(screen.getByText(/ainda pode cancelar os horários que já marcou/i)).toBeInTheDocument();
    });
  });
});
