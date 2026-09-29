import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StepProfessionals } from '../StepProfessionals';
import { StepSegmentation } from '../StepSegmentation';
import type { ProfessionalItem } from '../types';

// Spec 052, ticket 01: enquanto a assinatura não chega (ou se a leitura falha), o
// onboarding não mostra plano nem cota e não bloqueia o cadastro por um limite chutado.

const profissional = (id: string): ProfessionalItem => ({
  id,
  name: `Barbeiro ${id}`,
  phone: '(92) 99999-9999',
  commissionPercentage: 50,
});

const renderProfessionals = (props: {
  planName: string | null;
  maxProfessionals: number | null;
  professionals: ProfessionalItem[];
  ehMaiorPlano?: boolean;
}) =>
  render(
    <StepProfessionals
      {...props}
      managerName="Gestor Teste"
      managerPhone=""
      submitting={false}
      onAddProfessional={vi.fn()}
      onRemoveProfessional={vi.fn()}
      onFinish={vi.fn()}
      onBack={vi.fn()}
    />
  );

const renderSegmentation = (props: { planName: string | null; maxProfessionals: number | null }) =>
  render(
    <StepSegmentation
      {...props}
      data={{ baseCutPrice: 0, acquisitionChannel: '' }}
      onChange={vi.fn()}
      onNext={vi.fn()}
      onBack={vi.fn()}
    />
  );

describe('Plano no onboarding (spec 052, ticket 01)', () => {
  describe('StepProfessionals', () => {
    it('sem plano carregado não mostra cota nem plano e não trava o cadastro', () => {
      renderProfessionals({ planName: null, maxProfessionals: null, professionals: [profissional('1'), profissional('2')] });

      expect(screen.queryByText(/barbeiros cadastrados/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/^Plano /)).not.toBeInTheDocument();
      expect(screen.queryByText('Limite Atingido')).not.toBeInTheDocument();
      expect(screen.getByText(/também atende clientes/i)).toBeInTheDocument();
    });

    it('com o plano carregado mostra a cota e o limite atingido', () => {
      renderProfessionals({ planName: 'Tesoura', maxProfessionals: 1, professionals: [profissional('1')] });

      expect(screen.getByText(/1 de 1 barbeiro cadastrado/i)).toBeInTheDocument();
      expect(screen.getByText('Plano Tesoura')).toBeInTheDocument();
      expect(screen.getByText('Limite Atingido')).toBeInTheDocument();
    });

    it('no limite, troca o formulário por uma mensagem amigável que convida a mudar de plano', () => {
      renderProfessionals({ planName: 'Máquina', maxProfessionals: 5, professionals: ['1', '2', '3', '4', '5'].map(profissional) });

      const mensagem = screen.getByText(/Você atingiu o limite de 5 profissionais do plano Máquina/i);
      expect(mensagem).toHaveTextContent(/plano maior/i);
      expect(screen.queryByLabelText('Nome do Barbeiro')).not.toBeInTheDocument();
    });

    it('no maior plano do catálogo, a mensagem manda falar com o suporte', () => {
      renderProfessionals({
        planName: 'Bancada',
        maxProfessionals: 10,
        professionals: Array.from({ length: 10 }, (_, i) => profissional(String(i))),
        ehMaiorPlano: true,
      });

      const mensagem = screen.getByText(/Você atingiu o limite de 10 profissionais do plano Bancada/i);
      expect(mensagem).toHaveTextContent(/suporte/i);
      expect(mensagem).not.toHaveTextContent(/plano maior/i);
    });
  });

  describe('StepSegmentation', () => {
    it('sem plano carregado não mostra o cartão do plano', () => {
      renderSegmentation({ planName: null, maxProfessionals: null });

      expect(screen.queryByText('Seu Plano Ativo')).not.toBeInTheDocument();
      expect(screen.queryByText(/^Plano /)).not.toBeInTheDocument();
    });

    it('com o plano carregado mostra o nome e o limite', () => {
      renderSegmentation({ planName: 'Máquina', maxProfessionals: 5 });

      expect(screen.getByText('Seu Plano Ativo')).toBeInTheDocument();
      expect(screen.getByText('Plano Máquina')).toBeInTheDocument();
      expect(screen.getByText(/5 profissionais/)).toBeInTheDocument();
    });
  });
});
