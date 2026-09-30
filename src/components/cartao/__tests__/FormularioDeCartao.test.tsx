import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CartaoRepository } from '../../../modules/cartao/CartaoRepository';
import { InMemoryCartaoAdapter } from '../../../modules/cartao/adapters/InMemoryCartaoAdapter';
import { ErroDoCartao } from '../../../modules/cartao/types';
import type { CamposDoCartao } from '../../../modules/cartao/types';
import { FormularioDeCartao } from '../FormularioDeCartao';

// Spec 052, ticket 09: o formulário do cartão. O número, a validade e o código de segurança ficam
// em campos que o Mercado Pago hospeda (aqui, só três lugares vazios onde o adaptador monta os
// campos); o Navalhado só tem o nome e o documento do titular. O formulário entrega o token a
// quem o abriu (trocar cartão agora, subir de plano no ticket 10).

const CPF_VALIDO = '529.982.247-25';

const montar = (props: Partial<React.ComponentProps<typeof FormularioDeCartao>> = {}) => {
  const adapter = new InMemoryCartaoAdapter();
  const onToken = vi.fn().mockResolvedValue(undefined);
  render(
    <FormularioDeCartao
      rotuloDoBotao="Salvar cartão"
      onToken={onToken}
      repositorio={new CartaoRepository(adapter)}
      {...props}
    />,
  );
  return { adapter, onToken };
};

const preencherOTitular = async (nome = 'Maria da Silva', documento = CPF_VALIDO) => {
  await userEvent.type(screen.getByLabelText('Nome no cartão'), nome);
  await userEvent.type(screen.getByLabelText('CPF ou CNPJ do titular'), documento);
};

describe('FormularioDeCartao', () => {
  it('monta os campos seguros nos três lugares da tela e deixa só o titular como campo do Navalhado', async () => {
    const { adapter } = montar();

    await waitFor(() => expect(adapter.montados).toHaveLength(1));
    const numero = screen.getByRole('group', { name: 'Número do cartão' });
    const validade = screen.getByRole('group', { name: 'Validade' });
    const codigo = screen.getByRole('group', { name: 'Código de segurança' });
    expect(adapter.montados).toEqual([{ numero: numero.id, validade: validade.id, codigo: codigo.id }]);
    // O Navalhado não tem campo de número nem de código: só o nome e o documento.
    expect(screen.getAllByRole('textbox')).toHaveLength(2);
    expect(screen.getByLabelText('Nome no cartão')).toBeInTheDocument();
    expect(screen.getByLabelText('CPF ou CNPJ do titular')).toBeInTheDocument();
  });

  it('gera o token com o titular e entrega só o token a quem abriu o formulário', async () => {
    const { adapter, onToken } = montar();
    await waitFor(() => expect(adapter.montados).toHaveLength(1));
    await preencherOTitular();

    await userEvent.click(screen.getByRole('button', { name: 'Salvar cartão' }));

    await waitFor(() => expect(onToken).toHaveBeenCalledWith('token-falso-1'));
    expect(adapter.titularesRecebidos).toEqual([{ nome: 'Maria da Silva', documento: '52998224725' }]);
  });

  it('CPF inválido: mostra o motivo perto do campo e não gera token', async () => {
    const { adapter, onToken } = montar();
    await waitFor(() => expect(adapter.montados).toHaveLength(1));
    await preencherOTitular('Maria da Silva', '111.111.111-11');

    await userEvent.click(screen.getByRole('button', { name: 'Salvar cartão' }));

    expect(await screen.findByText('Digite um CPF ou CNPJ válido.')).toBeInTheDocument();
    expect(onToken).not.toHaveBeenCalled();
    expect(adapter.titularesRecebidos).toHaveLength(0);
  });

  it('nome curto: mostra o motivo e não gera token', async () => {
    const { adapter, onToken } = montar();
    await waitFor(() => expect(adapter.montados).toHaveLength(1));
    await preencherOTitular('Ma', CPF_VALIDO);

    await userEvent.click(screen.getByRole('button', { name: 'Salvar cartão' }));

    expect(await screen.findByText('Digite o nome como está no cartão.')).toBeInTheDocument();
    expect(onToken).not.toHaveBeenCalled();
  });

  it('cartão que o Mercado Pago não validou: mostra a mensagem e deixa tentar de novo', async () => {
    const { adapter, onToken } = montar();
    await waitFor(() => expect(adapter.montados).toHaveLength(1));
    await preencherOTitular();
    adapter.falharCom = new ErroDoCartao('Não foi possível validar o cartão. Confira o número, a validade e o código de segurança.', 'cartao');

    await userEvent.click(screen.getByRole('button', { name: 'Salvar cartão' }));

    expect(await screen.findByText(/não foi possível validar o cartão/i)).toBeInTheDocument();
    expect(onToken).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Salvar cartão' })).toBeEnabled();
  });

  it('mostra o erro de quem abriu o formulário (a troca recusada, por exemplo)', async () => {
    montar({ erro: 'O Mercado Pago não aceitou o cartão. Confira os dados ou use outro cartão.' });

    expect(await screen.findByRole('alert')).toHaveTextContent('O Mercado Pago não aceitou o cartão.');
  });

  it('enquanto a ação de quem abriu o formulário está em andamento, o botão fica desligado', async () => {
    const { adapter } = montar({ enviando: true });
    await waitFor(() => expect(adapter.montados).toHaveLength(1));

    expect(screen.getByRole('button', { name: /salvar cartão/i })).toBeDisabled();
  });

  it('falha ao carregar os campos seguros: avisa e oferece tentar de novo', async () => {
    const adapter = new InMemoryCartaoAdapter();
    adapter.falharCom = new ErroDoCartao('Não foi possível carregar o formulário do cartão. Tente de novo.', 'cartao');
    render(<FormularioDeCartao rotuloDoBotao="Salvar cartão" onToken={vi.fn()} repositorio={new CartaoRepository(adapter)} />);

    expect(await screen.findByText('Não foi possível carregar o formulário do cartão. Tente de novo.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Salvar cartão' })).toBeDisabled();

    adapter.falharCom = null;
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));

    await waitFor(() => expect(adapter.montados).toHaveLength(1));
    expect(screen.queryByText(/não foi possível carregar/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Salvar cartão' })).toBeEnabled();
  });

  it('o botão só liga depois de os campos seguros carregarem', async () => {
    const adapter = new InMemoryCartaoAdapter();
    let liberar: () => void = () => {};
    adapter.montarCampos = () =>
      new Promise<CamposDoCartao>((resolver) => {
        liberar = () => resolver({ gerarToken: async () => 'token', desmontar: () => {} });
      });
    render(<FormularioDeCartao rotuloDoBotao="Salvar cartão" onToken={vi.fn()} repositorio={new CartaoRepository(adapter)} />);

    expect(screen.getByRole('button', { name: /salvar cartão/i })).toBeDisabled();
    liberar();

    await waitFor(() => expect(screen.getByRole('button', { name: /salvar cartão/i })).toBeEnabled());
  });

  it('tira os campos seguros da tela quando o formulário fecha', async () => {
    const adapter = new InMemoryCartaoAdapter();
    const { unmount } = render(
      <FormularioDeCartao rotuloDoBotao="Salvar cartão" onToken={vi.fn()} repositorio={new CartaoRepository(adapter)} />,
    );
    await waitFor(() => expect(adapter.montados).toHaveLength(1));

    unmount();

    expect(adapter.montados).toEqual([]);
  });

  it('fechar o formulário antes de os campos carregarem desmonta os campos que chegam depois', async () => {
    const adapter = new InMemoryCartaoAdapter();
    const desmontar = vi.fn();
    let liberar: () => void = () => {};
    adapter.montarCampos = () =>
      new Promise<CamposDoCartao>((resolver) => {
        liberar = () => resolver({ gerarToken: async () => 'token', desmontar });
      });
    const { unmount } = render(
      <FormularioDeCartao rotuloDoBotao="Salvar cartão" onToken={vi.fn()} repositorio={new CartaoRepository(adapter)} />,
    );

    unmount();
    liberar();

    await waitFor(() => expect(desmontar).toHaveBeenCalledTimes(1));
  });

  it('dois formulários abertos ao mesmo tempo têm cada um os seus campos: fechar um não tira os do outro', async () => {
    const adapter = new InMemoryCartaoAdapter();
    const repositorio = new CartaoRepository(adapter);
    const primeiro = render(<FormularioDeCartao rotuloDoBotao="Primeiro" onToken={vi.fn()} repositorio={repositorio} />);
    const segundo = render(<FormularioDeCartao rotuloDoBotao="Segundo" onToken={vi.fn()} repositorio={repositorio} />);
    await waitFor(() => expect(adapter.montados).toHaveLength(2));

    primeiro.unmount();

    expect(adapter.montados).toHaveLength(1);
    expect(segundo.container.querySelector('[role="group"]')?.id).toBe(adapter.montados[0].numero);
  });

  it('cancelar chama quem abriu o formulário', async () => {
    const onCancelar = vi.fn();
    montar({ onCancelar });

    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(onCancelar).toHaveBeenCalledTimes(1);
  });

  it('sem onCancelar, não mostra o botão de cancelar', () => {
    montar();

    expect(screen.queryByRole('button', { name: 'Cancelar' })).not.toBeInTheDocument();
  });

  it('o formulário usa o rótulo que quem o abriu escolheu', async () => {
    montar({ rotuloDoBotao: 'Pagar a diferença' });

    expect(await screen.findByRole('button', { name: 'Pagar a diferença' })).toBeInTheDocument();
  });
});
