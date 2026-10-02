import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { POLITICA_DE_PRIVACIDADE, TERMOS_DE_USO, VERSAO_ATUAL_DOS_TERMOS, dataDaVersao } from '../../../modules/termos/textos';
import { TermosDaPlataformaModal } from '../TermosDaPlataformaModal';

// Spec 052, ticket 16: os Termos de Uso e a Política de Privacidade da plataforma, que o Gerente aceita. O Canal do Cliente tem o
// próprio texto (LegalModal): o cliente da barbearia não contrata a assinatura.

describe('TermosDaPlataformaModal', () => {
  it('fechado, não mostra nada', () => {
    render(<TermosDaPlataformaModal isOpen={false} onClose={vi.fn()} documento="termos" />);

    expect(screen.queryByRole('heading', { name: TERMOS_DE_USO.titulo })).not.toBeInTheDocument();
  });

  it('termos: mostra o título, a versão e todas as seções dos Termos de Uso', () => {
    render(<TermosDaPlataformaModal isOpen onClose={vi.fn()} documento="termos" />);

    expect(screen.getByRole('heading', { name: TERMOS_DE_USO.titulo })).toBeInTheDocument();
    expect(screen.getByText(`Versão de ${dataDaVersao(VERSAO_ATUAL_DOS_TERMOS)}`)).toBeInTheDocument();
    for (const secao of TERMOS_DE_USO.secoes) {
      expect(screen.getByRole('heading', { name: secao.titulo })).toBeInTheDocument();
    }
    expect(screen.getByText(/se renova sozinha a cada mês/)).toBeInTheDocument();
  });

  it('privacidade: mostra o título, a versão e todas as seções da Política de Privacidade', () => {
    render(<TermosDaPlataformaModal isOpen onClose={vi.fn()} documento="privacidade" />);

    expect(screen.getByRole('heading', { name: POLITICA_DE_PRIVACIDADE.titulo })).toBeInTheDocument();
    expect(screen.getByText(`Versão de ${dataDaVersao(VERSAO_ATUAL_DOS_TERMOS)}`)).toBeInTheDocument();
    for (const secao of POLITICA_DE_PRIVACIDADE.secoes) {
      expect(screen.getByRole('heading', { name: secao.titulo })).toBeInTheDocument();
    }
    expect(screen.queryByRole('heading', { name: TERMOS_DE_USO.titulo })).not.toBeInTheDocument();
  });

  it('o botão Fechar chama onClose', () => {
    const onClose = vi.fn();
    render(<TermosDaPlataformaModal isOpen onClose={onClose} documento="termos" />);

    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
