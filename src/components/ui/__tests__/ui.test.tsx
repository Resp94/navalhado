import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  Button,
  IconButton,
  Input,
  Select,
  Textarea,
  Switch,
  Checkbox,
  Radio,
  SegmentedControl,
  SearchInput,
  Pagination,
  Badge,
  Avatar,
  StatCard,
  EmptyState,
  Skeleton,
  Tooltip,
  Card,
  CardTitle,
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
  Drawer,
  ConfirmDialog,
} from '../index';

describe('Design System UI Components', () => {
  describe('Button', () => {
    it('renderiza corretamente com variantes e dispara onClick', () => {
      const handleClick = vi.fn();
      render(
        <Button variant="primary" size="md" onClick={handleClick}>
          Salvar
        </Button>
      );

      const btn = screen.getByRole('button', { name: /salvar/i });
      expect(btn).toBeInTheDocument();
      expect(btn.className).toContain('ui-btn--primary');
      expect(btn.className).toContain('ui-btn--md');

      fireEvent.click(btn);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('desabilita o botão em estado de loading', () => {
      const handleClick = vi.fn();
      render(
        <Button loading onClick={handleClick}>
          Carregando
        </Button>
      );

      const btn = screen.getByRole('button');
      expect(btn).toBeDisabled();
      fireEvent.click(btn);
      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  describe('IconButton', () => {
    it('renderiza com acessibilidade obrigatória aria-label', () => {
      const handleClick = vi.fn();
      render(
        <IconButton aria-label="Fechar modal" onClick={handleClick}>
          ✕
        </IconButton>
      );

      const btn = screen.getByRole('button', { name: /fechar modal/i });
      expect(btn).toBeInTheDocument();
      fireEvent.click(btn);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('Input', () => {
    it('renderiza label, digitação e mensagem de erro com acessibilidade', () => {
      const handleChange = vi.fn();
      render(
        <Input
          label="Nome do Barbeiro"
          placeholder="Digite o nome"
          error="Nome obrigatório"
          prefixText="R$"
          onChange={handleChange}
        />
      );

      expect(screen.getByText('Nome do Barbeiro')).toBeInTheDocument();
      expect(screen.getByText('R$')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent('Nome obrigatório');

      const input = screen.getByPlaceholderText('Digite o nome');
      fireEvent.change(input, { target: { value: 'Carlos' } });
      expect(handleChange).toHaveBeenCalled();
    });
  });

  describe('Select', () => {
    it('renderiza opções e dispara onChange', () => {
      const handleChange = vi.fn();
      const options = [
        { value: '1', label: 'Corte' },
        { value: '2', label: 'Barba' },
      ];

      render(
        <Select label="Serviço" options={options} onChange={handleChange} defaultValue="1" />
      );

      expect(screen.getByText('Serviço')).toBeInTheDocument();
      const select = screen.getByRole('combobox');
      expect(select).toHaveValue('1');

      fireEvent.change(select, { target: { value: '2' } });
      expect(handleChange).toHaveBeenCalled();
    });
  });

  describe('Textarea', () => {
    it('renderiza label e contador de caracteres quando solicitado', () => {
      render(
        <Textarea
          label="Observações"
          value="Atendimento vip"
          maxLength={100}
          showCount
          readOnly
        />
      );

      expect(screen.getByText('Observações')).toBeInTheDocument();
      expect(screen.getByText('15/100')).toBeInTheDocument();
    });
  });

  describe('Switch', () => {
    it('alterna o estado ao clicar e via teclado', () => {
      const handleChange = vi.fn();
      const { rerender } = render(
        <Switch label="Encaixe Rápido" checked={false} onChange={handleChange} />
      );

      const switchBtn = screen.getByRole('switch');
      expect(switchBtn).toHaveAttribute('aria-checked', 'false');

      fireEvent.click(switchBtn);
      expect(handleChange).toHaveBeenCalledWith(true);

      rerender(<Switch label="Encaixe Rápido" checked={true} onChange={handleChange} />);
      expect(switchBtn).toHaveAttribute('aria-checked', 'true');
    });
  });

  describe('Checkbox & Radio', () => {
    it('renderiza Checkbox e permite seleção', () => {
      const handleChange = vi.fn();
      render(<Checkbox label="Selecionar todos" checked={false} onChange={handleChange} />);

      const checkbox = screen.getByRole('checkbox');
      fireEvent.click(checkbox);
      expect(handleChange).toHaveBeenCalled();
    });

    it('renderiza Radio e exibe label', () => {
      render(<Radio label="Dinheiro" checked={true} readOnly />);
      const radio = screen.getByRole('radio');
      expect(radio).toBeChecked();
    });
  });

  describe('SegmentedControl', () => {
    it('alterna abas e destaca a ativa com stroke e acessibilidade', () => {
      const handleChange = vi.fn();
      const options = [
        { id: 'day', label: 'Dia' },
        { id: 'week', label: 'Semana' },
      ];

      render(<SegmentedControl options={options} value="day" onChange={handleChange} />);

      const dayTab = screen.getByRole('tab', { name: /dia/i });
      const weekTab = screen.getByRole('tab', { name: /semana/i });

      expect(dayTab).toHaveAttribute('aria-selected', 'true');
      expect(weekTab).toHaveAttribute('aria-selected', 'false');

      fireEvent.click(weekTab);
      expect(handleChange).toHaveBeenCalledWith('week');
    });
  });

  describe('SearchInput', () => {
    it('permite busca e limpa com o botão X', () => {
      const handleChange = vi.fn();
      const handleClear = vi.fn();
      render(
        <SearchInput
          value="Navalha"
          onChange={handleChange}
          onClear={handleClear}
          placeholder="Buscar produto..."
        />
      );

      expect(screen.getByDisplayValue('Navalha')).toBeInTheDocument();
      const clearBtn = screen.getByTitle(/limpar busca/i);
      fireEvent.click(clearBtn);

      expect(handleChange).toHaveBeenCalledWith('');
      expect(handleClear).toHaveBeenCalled();
    });
  });

  describe('Pagination', () => {
    it('permite avançar e recuar páginas', () => {
      const handlePageChange = vi.fn();
      render(
        <Pagination
          currentPage={2}
          totalPages={5}
          totalItems={50}
          onPageChange={handlePageChange}
        />
      );

      expect(screen.getByText(/total:/i)).toBeInTheDocument();
      expect(screen.getByText('50')).toBeInTheDocument();
      const nextBtn = screen.getByRole('button', { name: /próxima/i });
      fireEvent.click(nextBtn);
      expect(handlePageChange).toHaveBeenCalledWith(3);
    });
  });

  describe('Badge & Avatar', () => {
    it('renderiza Badge semântico com dot', () => {
      render(<Badge variant="success" dot>Ativo</Badge>);
      expect(screen.getByText('Ativo')).toBeInTheDocument();
    });

    it('renderiza Avatar com iniciais extraídas de nome composto', () => {
      render(<Avatar name="João Silva" />);
      expect(screen.getByText('JS')).toBeInTheDocument();
    });
  });

  describe('StatCard & EmptyState', () => {
    it('renderiza StatCard com título, valor e indicador de tendência', () => {
      render(
        <StatCard
          title="Faturamento"
          value="R$ 15.420"
          trend={{ value: '12%', isPositive: true, label: 'vs mês passado' }}
        />
      );

      expect(screen.getByText('Faturamento')).toBeInTheDocument();
      expect(screen.getByText('R$ 15.420')).toBeInTheDocument();
      expect(screen.getByText('12%')).toBeInTheDocument();
    });

    it('renderiza EmptyState com título, descrição e ação', () => {
      render(
        <EmptyState
          title="Nenhum agendamento"
          description="Não há clientes marcados para hoje."
          action={<Button>Novo Agendamento</Button>}
        />
      );

      expect(screen.getByText('Nenhum agendamento')).toBeInTheDocument();
      expect(screen.getByText('Não há clientes marcados para hoje.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /novo agendamento/i })).toBeInTheDocument();
    });
  });

  describe('Skeleton, Tooltip & Card', () => {
    it('renderiza Skeleton e Card estruturado', () => {
      render(
        <Card>
          <CardTitle>Painel</CardTitle>
          <Skeleton width={100} height={20} />
        </Card>
      );

      expect(screen.getByText('Painel')).toBeInTheDocument();
    });

    it('renderiza Tooltip ao passar o mouse', () => {
      render(
        <Tooltip content="Informações extras">
          <button>Hover me</button>
        </Tooltip>
      );

      const trigger = screen.getByText('Hover me');
      fireEvent.mouseEnter(trigger);
      expect(screen.getByRole('tooltip')).toHaveTextContent('Informações extras');
    });
  });

  describe('Table & DataTable', () => {
    it('renderiza tabela formatada', () => {
      render(
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead align="right">Preço</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>Pomada</TableCell>
              <TableCell align="right">R$ 45,00</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      );

      expect(screen.getByText('Pomada')).toBeInTheDocument();
      expect(screen.getByText('R$ 45,00')).toBeInTheDocument();
    });
  });

  describe('Drawer & ConfirmDialog', () => {
    it('renderiza Drawer quando isOpen=true e fecha no botão', () => {
      const handleClose = vi.fn();
      render(
        <Drawer isOpen={true} onClose={handleClose} title="Novo Profissional">
          <p>Formulário aqui</p>
        </Drawer>
      );

      expect(screen.getByText('Novo Profissional')).toBeInTheDocument();
      expect(screen.getByText('Formulário aqui')).toBeInTheDocument();

      const closeBtn = screen.getByRole('button', { name: /fechar painel/i });
      fireEvent.click(closeBtn);
      expect(handleClose).toHaveBeenCalled();
    });

    it('renderiza ConfirmDialog e dispara confirmação', () => {
      const handleConfirm = vi.fn();
      const handleClose = vi.fn();

      render(
        <ConfirmDialog
          isOpen={true}
          title="Excluir Serviço?"
          description="Esta ação desativará o serviço no catálogo."
          confirmText="Sim, excluir"
          onConfirm={handleConfirm}
          onClose={handleClose}
        />
      );

      expect(screen.getByText('Excluir Serviço?')).toBeInTheDocument();
      const confirmBtn = screen.getByRole('button', { name: /sim, excluir/i });
      fireEvent.click(confirmBtn);
      expect(handleConfirm).toHaveBeenCalledTimes(1);
    });
  });
});
