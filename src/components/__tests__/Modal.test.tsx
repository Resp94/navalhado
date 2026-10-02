import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Modal } from '../Modal';

// Spec 052, ticket 16 (revisão): o modal dos termos barra todo Gerente sem aceite, então o diálogo precisa ser acessível por teclado e
// por leitor de tela: papel de diálogo, foco que entra e volta, e Escape.

const Abridor = ({ onClose = () => {} }: { onClose?: () => void }) => {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <button onClick={() => setAberto(true)}>Abrir</button>
      <Modal
        isOpen={aberto}
        onClose={() => {
          onClose();
          setAberto(false);
        }}
        title="Título do teste"
      >
        <p>conteúdo</p>
      </Modal>
    </>
  );
};

describe('Modal', () => {
  it('fechado, não mostra nada', () => {
    render(
      <Modal isOpen={false} onClose={vi.fn()} title="Título do teste">
        <p>conteúdo</p>
      </Modal>,
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('aberto, é um diálogo modal com o nome do título', () => {
    render(
      <Modal isOpen onClose={vi.fn()} title="Título do teste">
        <p>conteúdo</p>
      </Modal>,
    );

    const dialogo = screen.getByRole('dialog', { name: 'Título do teste' });
    expect(dialogo).toHaveAttribute('aria-modal', 'true');
    expect(dialogo).toHaveTextContent('conteúdo');
  });

  it('o foco entra no diálogo ao abrir', () => {
    render(
      <Modal isOpen onClose={vi.fn()} title="Título do teste">
        <p>conteúdo</p>
      </Modal>,
    );

    expect(screen.getByRole('dialog')).toHaveFocus();
  });

  it('não tira o foco de um campo que já está dentro do diálogo', () => {
    render(
      <Modal isOpen onClose={vi.fn()} title="Título do teste">
        <input aria-label="campo" autoFocus />
      </Modal>,
    );

    expect(screen.getByLabelText('campo')).toHaveFocus();
  });

  it('ao fechar, o foco volta para quem abriu', () => {
    render(<Abridor />);
    const abrir = screen.getByRole('button', { name: 'Abrir' });
    abrir.focus();

    fireEvent.click(abrir);
    expect(screen.getByRole('dialog')).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(abrir).toHaveFocus();
  });

  it('Escape fecha o modal', () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} title="Título do teste">
        <p>conteúdo</p>
      </Modal>,
    );

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Escape com o foco no corpo da página também fecha', () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} title="Título do teste">
        <p>conteúdo</p>
      </Modal>,
    );

    fireEvent.keyDown(document.body, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('outra tecla não fecha', () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} title="Título do teste">
        <p>conteúdo</p>
      </Modal>,
    );

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Enter' });

    expect(onClose).not.toHaveBeenCalled();
  });

  // Um menu de dentro do modal (os do Radix) fecha a si mesmo com o Escape e marca o evento como tratado: o modal não fecha junto.
  it('o Escape que um componente de dentro já tratou não fecha o modal', () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} title="Título do teste">
        <input aria-label="campo" onKeyDown={(evento) => evento.key === 'Escape' && evento.preventDefault()} />
      </Modal>,
    );

    fireEvent.keyDown(screen.getByLabelText('campo'), { key: 'Escape' });

    expect(onClose).not.toHaveBeenCalled();
  });

  it('o Escape que vem de fora do diálogo (um menu em portal, por exemplo) não fecha o modal', () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} title="Título do teste">
        <p>conteúdo</p>
      </Modal>,
    );
    const menuEmPortal = document.createElement('div');
    document.body.appendChild(menuEmPortal);

    fireEvent.keyDown(menuEmPortal, { key: 'Escape' });

    expect(onClose).not.toHaveBeenCalled();
    menuEmPortal.remove();
  });

  it('depois de fechado, o Escape não chama mais onClose', () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <Modal isOpen onClose={onClose} title="Título do teste">
        <p>conteúdo</p>
      </Modal>,
    );

    rerender(
      <Modal isOpen={false} onClose={onClose} title="Título do teste">
        <p>conteúdo</p>
      </Modal>,
    );
    fireEvent.keyDown(document.body, { key: 'Escape' });

    expect(onClose).not.toHaveBeenCalled();
  });

  // Quem usa o modal passa um onClose novo a cada render: isso não pode devolver o foco a quem abriu nem trocar o ouvinte.
  it('renderizar de novo com outro onClose, com o modal aberto, mantém o foco dentro e usa o onClose mais novo no Escape', () => {
    const antigo = vi.fn();
    const novo = vi.fn();
    const { rerender } = render(
      <Modal isOpen onClose={antigo} title="Título do teste">
        <input aria-label="campo" autoFocus />
      </Modal>,
    );

    rerender(
      <Modal isOpen onClose={novo} title="Título do teste">
        <input aria-label="campo" autoFocus />
      </Modal>,
    );

    expect(screen.getByLabelText('campo')).toHaveFocus();
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(antigo).not.toHaveBeenCalled();
    expect(novo).toHaveBeenCalledTimes(1);
  });

  it('o clique no fundo fecha, e o clique no conteúdo não', () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} title="Título do teste">
        <p>conteúdo</p>
      </Modal>,
    );

    fireEvent.click(screen.getByText('conteúdo'));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('dialog').parentElement as HTMLElement);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
