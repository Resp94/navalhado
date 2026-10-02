import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { POLITICA_DE_PRIVACIDADE, TERMOS_DE_USO, VERSAO_ATUAL_DOS_TERMOS, dataDaVersao } from '../../../modules/termos/textos';
import { TelaDeAceiteDosTermos } from '../TelaDeAceiteDosTermos';

// Spec 052, ticket 16: o Gerente que ainda não aceitou a versão atual dos termos vê esta tela antes do painel.

const renderizar = (props: Partial<React.ComponentProps<typeof TelaDeAceiteDosTermos>> = {}) => {
  const onAceitar = vi.fn();
  const onLogout = vi.fn();
  render(<TelaDeAceiteDosTermos aceitando={false} erro={null} onAceitar={onAceitar} onLogout={onLogout} {...props} />);
  return { onAceitar, onLogout };
};

const caixaDeAceite = () => screen.getByRole('checkbox', { name: /Li e aceito/ });
const botaoDeAceitar = () => screen.getByRole('button', { name: 'Aceitar e continuar' });

describe('TelaDeAceiteDosTermos', () => {
  it('pede o aceite da versão atual e começa sem aceitar', () => {
    renderizar();

    expect(screen.getByRole('heading', { name: 'Termos de Uso e Política de Privacidade' })).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`versão de ${dataDaVersao(VERSAO_ATUAL_DOS_TERMOS)}`))).toBeInTheDocument();
    expect(caixaDeAceite()).not.toBeChecked();
    expect(botaoDeAceitar()).toBeDisabled();
  });

  it('marcar o aceite libera o botão, e clicar chama onAceitar uma vez', () => {
    const { onAceitar } = renderizar();

    fireEvent.click(caixaDeAceite());
    expect(botaoDeAceitar()).toBeEnabled();
    fireEvent.click(botaoDeAceitar());

    expect(onAceitar).toHaveBeenCalledTimes(1);
  });

  it('desmarcar de novo trava o botão', () => {
    renderizar();

    fireEvent.click(caixaDeAceite());
    fireEvent.click(caixaDeAceite());

    expect(botaoDeAceitar()).toBeDisabled();
  });

  it('sem marcar o aceite, o envio do formulário não chama onAceitar', () => {
    const { onAceitar } = renderizar();

    fireEvent.submit(botaoDeAceitar().closest('form') as HTMLFormElement);

    expect(onAceitar).not.toHaveBeenCalled();
  });

  it('enquanto o aceite é gravado, o botão mostra o andamento, fica travado e o aceite não muda', () => {
    renderizar({ aceitando: true });

    expect(screen.getByRole('button', { name: 'Registrando…' })).toBeDisabled();
    expect(caixaDeAceite()).toBeDisabled();
  });

  it('mostra o erro de gravar o aceite', () => {
    renderizar({ erro: 'Não foi possível registrar o seu aceite. Tente de novo.' });

    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível registrar o seu aceite. Tente de novo.');
  });

  it('sem erro, não mostra alerta', () => {
    renderizar();

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('"Ler os Termos de Uso" abre o texto dos termos, e fechar volta para a tela', () => {
    renderizar();

    fireEvent.click(screen.getByRole('button', { name: 'Ler os Termos de Uso' }));
    expect(screen.getByRole('heading', { name: TERMOS_DE_USO.titulo })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: TERMOS_DE_USO.secoes[0].titulo })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(screen.queryByRole('heading', { name: TERMOS_DE_USO.titulo })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Termos de Uso e Política de Privacidade' })).toBeInTheDocument();
  });

  it('"Ler a Política de Privacidade" abre o texto da política', () => {
    renderizar();

    fireEvent.click(screen.getByRole('button', { name: 'Ler a Política de Privacidade' }));

    expect(screen.getByRole('heading', { name: POLITICA_DE_PRIVACIDADE.titulo })).toBeInTheDocument();
  });

  it('ler os textos não marca o aceite', () => {
    renderizar();

    fireEvent.click(screen.getByRole('button', { name: 'Ler os Termos de Uso' }));
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));

    expect(caixaDeAceite()).not.toBeChecked();
  });

  it('"Sair da conta" chama onLogout', () => {
    const { onLogout } = renderizar();

    fireEvent.click(screen.getByRole('button', { name: 'Sair da conta' }));

    expect(onLogout).toHaveBeenCalledTimes(1);
  });
});
