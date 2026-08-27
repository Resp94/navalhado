import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ConfirmSoftDeleteModal } from "../ConfirmSoftDeleteModal";

describe("ConfirmSoftDeleteModal", () => {
  it("não renderiza nada quando isOpen for false", () => {
    const { container } = render(
      <ConfirmSoftDeleteModal
        isOpen={false}
        title="Excluir profissional"
        itemName="Carlos Barbeiro"
        itemTypeLabel="o profissional"
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("renderiza o título, o nome do item e o aviso de histórico preservado quando aberto", () => {
    render(
      <ConfirmSoftDeleteModal
        isOpen={true}
        title="Excluir profissional"
        itemName="Marcos Barbeiro"
        itemTypeLabel="o profissional"
        warningText="O histórico de atendimentos e comandas será 100% preservado."
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Excluir profissional" })).toBeInTheDocument();
    expect(screen.getByText(/Marcos Barbeiro/)).toBeInTheDocument();
    expect(screen.getByText(/O histórico de atendimentos e comandas será 100% preservado/)).toBeInTheDocument();
  });

  it("chama onConfirm ao clicar em Sim, excluir", () => {
    const handleConfirm = vi.fn();
    const handleClose = vi.fn();

    render(
      <ConfirmSoftDeleteModal
        isOpen={true}
        title="Excluir profissional"
        itemName="Marcos Barbeiro"
        itemTypeLabel="o profissional"
        onConfirm={handleConfirm}
        onClose={handleClose}
      />
    );

    const btnConfirm = screen.getByRole("button", { name: /Sim, excluir/i });
    fireEvent.click(btnConfirm);

    expect(handleConfirm).toHaveBeenCalledTimes(1);
    expect(handleClose).not.toHaveBeenCalled();
  });

  it("chama onClose ao clicar em Cancelar", () => {
    const handleConfirm = vi.fn();
    const handleClose = vi.fn();

    render(
      <ConfirmSoftDeleteModal
        isOpen={true}
        title="Excluir profissional"
        itemName="Marcos Barbeiro"
        itemTypeLabel="o profissional"
        onConfirm={handleConfirm}
        onClose={handleClose}
      />
    );

    const btnCancel = screen.getByRole("button", { name: /Cancelar/i });
    fireEvent.click(btnCancel);

    expect(handleClose).toHaveBeenCalledTimes(1);
    expect(handleConfirm).not.toHaveBeenCalled();
  });

  it("chama onClose ao pressionar tecla Escape", () => {
    const handleClose = vi.fn();

    render(
      <ConfirmSoftDeleteModal
        isOpen={true}
        title="Excluir profissional"
        itemName="Marcos Barbeiro"
        itemTypeLabel="o profissional"
        onConfirm={vi.fn()}
        onClose={handleClose}
      />
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("desabilita botões e exibe estado de loading quando loading for true", () => {
    const handleConfirm = vi.fn();

    render(
      <ConfirmSoftDeleteModal
        isOpen={true}
        title="Excluir profissional"
        itemName="Marcos Barbeiro"
        itemTypeLabel="o profissional"
        loading={true}
        onConfirm={handleConfirm}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: /Excluindo.../i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Cancelar/i })).toBeDisabled();
  });
});
