import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CartaoRepository } from '../../../modules/cartao/CartaoRepository';
import { InMemoryCartaoAdapter } from '../../../modules/cartao/adapters/InMemoryCartaoAdapter';
import type { CotacaoDaTroca, PlanoTrocado } from '../../../modules/assinatura/types';
import type { Plano } from '../../../modules/planos/types';

const { mockCotar, mockTrocar, mockUsePlanos } = vi.hoisted(() => ({
  mockCotar: vi.fn(),
  mockTrocar: vi.fn(),
  mockUsePlanos: vi.fn(),
}));

vi.mock('../../../modules/assinatura/repositorio', () => ({
  assinaturaRepository: {
    cotarTrocaDePlano: (...args: unknown[]) => mockCotar(...args),
    trocarDePlano: (...args: unknown[]) => mockTrocar(...args),
  },
}));

vi.mock('../../../modules/planos/usePlanos', () => ({ usePlanos: () => mockUsePlanos() }));

import { MudarDePlano } from '../MudarDePlano';

// Spec 052, ticket 10: mudar de plano pela tela Assinatura. Em teste a troca é livre; na assinatura
// ativa o Gerente só sobe, vê a diferença proporcional e o valor mensal novo ANTES de confirmar e paga a
// diferença no cartão digitado nos campos seguros. Recusado, o plano continua o mesmo.

const CPF_VALIDO = '529.982.247-25';

const tesoura: Plano = { id: 'plano-tesoura', name: 'Tesoura', price: 59.9, max_professionals: 1 };
const maquina: Plano = { id: 'plano-maquina', name: 'Máquina', price: 89.9, max_professionals: 5 };
const bancada: Plano = { id: 'plano-bancada', name: 'Bancada', price: 159.9, max_professionals: 10 };

type Assinatura = React.ComponentProps<typeof MudarDePlano>['assinatura'];
const ativaNaTesoura: Assinatura = { situacao: 'active', plano: { id: tesoura.id, nome: 'Tesoura', preco: 59.9 } };
const emTesteNaMaquina: Assinatura = { situacao: 'trialing', plano: { id: maquina.id, nome: 'Máquina', preco: 89.9 } };

const cotacaoComCobranca: CotacaoDaTroca = {
  modo: 'cobranca',
  diferenca: 20,
  valorMensalNovo: 89.9,
  diasRestantes: 20,
  diasDoPeriodo: 30,
  nomeDoPlano: 'Máquina',
};
const cotacaoLivre: CotacaoDaTroca = { ...cotacaoComCobranca, modo: 'livre', diferenca: 0, diasRestantes: null, diasDoPeriodo: null };
const cotacaoLivreDaBancada: CotacaoDaTroca = { ...cotacaoLivre, nomeDoPlano: 'Bancada', valorMensalNovo: 159.9 };
const trocado: PlanoTrocado = {
  planoId: maquina.id,
  nomeDoPlano: 'Máquina',
  cobrado: 20,
  valorMensalNovo: 89.9,
  proximaCobrancaAtualizada: true,
};

const comCatalogo = (status: 'loading' | 'ready' | 'error' = 'ready', planos: Plano[] = [tesoura, maquina, bancada]) =>
  mockUsePlanos.mockReturnValue({ planos, status, planoPadraoId: maquina.id, ehOMaiorPlano: () => false });

const renderizar = (assinatura: Assinatura = ativaNaTesoura) => {
  const adapter = new InMemoryCartaoAdapter();
  const onTrocado = vi.fn();
  render(<MudarDePlano assinatura={assinatura} onTrocado={onTrocado} repositorio={new CartaoRepository(adapter)} />);
  return { adapter, onTrocado };
};

const abrir = async (assinatura: Assinatura = ativaNaTesoura) => {
  const contexto = renderizar(assinatura);
  await userEvent.click(screen.getByRole('button', { name: 'Mudar de plano' }));
  return contexto;
};

const escolher = async (nome: RegExp | string) => {
  await userEvent.click(screen.getByRole('button', { name: nome }));
};

const pagar = async () => {
  await userEvent.type(screen.getByLabelText('Nome no cartão'), 'Maria da Silva');
  await userEvent.type(screen.getByLabelText('CPF ou CNPJ do titular'), CPF_VALIDO);
  await userEvent.click(screen.getByRole('button', { name: /^Pagar R\$\s20,00$/ }));
};

describe('MudarDePlano', () => {
  beforeEach(() => {
    mockCotar.mockReset();
    mockTrocar.mockReset();
    mockUsePlanos.mockReset();
    comCatalogo();
  });

  describe('quais planos oferece', () => {
    it('começa só com o botão: nada é cotado nem carregado até o Gerente abrir', () => {
      renderizar();

      expect(screen.getByRole('button', { name: 'Mudar de plano' })).toBeEnabled();
      expect(screen.queryByRole('button', { name: /Máquina/ })).not.toBeInTheDocument();
      expect(mockCotar).not.toHaveBeenCalled();
    });

    it('na assinatura ativa só oferece planos mais caros que o atual', async () => {
      await abrir();

      expect(screen.getByRole('button', { name: /Máquina/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Bancada/ })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Tesoura/ })).not.toBeInTheDocument();
    });

    it('em teste a troca é livre: oferece todos os outros planos, inclusive os mais baratos', async () => {
      await abrir(emTesteNaMaquina);

      expect(screen.getByRole('button', { name: /Tesoura/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Bancada/ })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Máquina/ })).not.toBeInTheDocument();
    });

    it('mostra o limite de profissionais e o preço de cada plano', async () => {
      await abrir();

      expect(screen.getByRole('button', { name: /Máquina/ })).toHaveTextContent('Até 5 profissionais');
      expect(screen.getByRole('button', { name: /Máquina/ })).toHaveTextContent(/R\$\s89,90/);
      expect(screen.getByRole('button', { name: /Bancada/ })).toHaveTextContent('Até 10 profissionais');
    });

    it('no maior plano da assinatura ativa não há para onde subir: sem botão', () => {
      renderizar({ situacao: 'active', plano: { id: bancada.id, nome: 'Bancada', preco: 159.9 } });

      expect(screen.queryByRole('button', { name: 'Mudar de plano' })).not.toBeInTheDocument();
    });

    it.each(['loading', 'error'] as const)('sem o catálogo (%s) não oferece a troca', (status) => {
      comCatalogo(status, []);
      renderizar();

      expect(screen.queryByRole('button', { name: 'Mudar de plano' })).not.toBeInTheDocument();
    });

    it('"Cancelar" fecha a lista de planos e volta ao botão', async () => {
      await abrir();

      await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

      expect(screen.queryByRole('button', { name: /Máquina/ })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Mudar de plano' })).toBeInTheDocument();
    });
  });

  describe('subir de plano na assinatura ativa', () => {
    it('ao escolher o plano, mostra a diferença e o valor mensal novo antes de confirmar; nada é cobrado nem trocado', async () => {
      mockCotar.mockResolvedValue(cotacaoComCobranca);
      const { adapter } = await abrir();

      await escolher(/Máquina/);

      expect(mockCotar).toHaveBeenCalledWith('plano-maquina');
      const resumo = await screen.findByText(/Você paga agora/);
      expect(resumo).toHaveTextContent(/R\$\s20,00/);
      expect(resumo).toHaveTextContent('proporcional ao que falta do período (20 de 30 dias)');
      expect(screen.getByText(/A partir da próxima cobrança, o plano Máquina custa/)).toHaveTextContent(/R\$\s89,90 por mês/);
      expect(screen.getByRole('button', { name: /^Pagar R\$\s20,00$/ })).toBeInTheDocument();
      await waitFor(() => expect(adapter.montados).toHaveLength(1));
      expect(mockTrocar).not.toHaveBeenCalled();
    });

    it('paga a diferença: manda o token, os 4 últimos dígitos e o valor confirmado, e avisa o plano novo e o limite', async () => {
      mockCotar.mockResolvedValue(cotacaoComCobranca);
      mockTrocar.mockResolvedValue(trocado);
      const { onTrocado } = await abrir();
      await escolher(/Máquina/);
      await screen.findByText(/Você paga agora/);

      await pagar();

      await waitFor(() =>
        expect(mockTrocar).toHaveBeenCalledWith('plano-maquina', { token: 'token-falso-1', final: '0604', valorConfirmado: 20 }),
      );
      expect(mockTrocar).toHaveBeenCalledTimes(1);
      const aviso = await screen.findByRole('status');
      expect(aviso).toHaveTextContent('Plano trocado para Máquina.');
      expect(aviso).toHaveTextContent(/Cobramos R\$\s20,00 da diferença\./);
      expect(aviso).toHaveTextContent('O limite do plano agora é de até 5 profissionais.');
      expect(aviso).toHaveTextContent(/O valor mensal passa a ser R\$\s89,90\./);
      expect(onTrocado).toHaveBeenCalledTimes(1);
    });

    it('cartão recusado: mostra o motivo, o plano continua o mesmo e o formulário fica para tentar de novo', async () => {
      mockCotar.mockResolvedValue(cotacaoComCobranca);
      mockTrocar.mockRejectedValue(new Error('O cartão não tem saldo suficiente. O plano continua o mesmo.'));
      const { onTrocado } = await abrir();
      await escolher(/Máquina/);
      await screen.findByText(/Você paga agora/);

      await pagar();

      expect(await screen.findByRole('alert')).toHaveTextContent('O cartão não tem saldo suficiente. O plano continua o mesmo.');
      expect(screen.getByLabelText('Nome no cartão')).toBeInTheDocument();
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      expect(onTrocado).not.toHaveBeenCalled();
    });

    it('depois de uma recusa, outro cartão limpa o erro e paga de novo com o novo token', async () => {
      mockCotar.mockResolvedValue(cotacaoComCobranca);
      mockTrocar.mockRejectedValueOnce(new Error('O cartão não tem saldo suficiente.'));
      mockTrocar.mockResolvedValueOnce(trocado);
      await abrir();
      await escolher(/Máquina/);
      await screen.findByText(/Você paga agora/);
      await pagar();
      await screen.findByRole('alert');

      await userEvent.click(screen.getByRole('button', { name: /^Pagar R\$\s20,00$/ }));

      await waitFor(() =>
        expect(mockTrocar).toHaveBeenLastCalledWith('plano-maquina', { token: 'token-falso-2', final: '0604', valorConfirmado: 20 }),
      );
      expect(await screen.findByRole('status')).toHaveTextContent('Plano trocado para Máquina.');
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('o valor mudou desde a cotação: mostra a recusa da função sem trocar nada', async () => {
      mockCotar.mockResolvedValue(cotacaoComCobranca);
      mockTrocar.mockRejectedValue(new Error('O valor da diferença mudou. Feche esta janela e abra de novo para ver o valor atual.'));
      await abrir();
      await escolher(/Máquina/);
      await screen.findByText(/Você paga agora/);

      await pagar();

      expect(await screen.findByRole('alert')).toHaveTextContent('O valor da diferença mudou.');
    });

    it('avisa quando o Mercado Pago não aceitou o valor novo da próxima cobrança', async () => {
      mockCotar.mockResolvedValue(cotacaoComCobranca);
      mockTrocar.mockResolvedValue({ ...trocado, proximaCobrancaAtualizada: false });
      await abrir();
      await escolher(/Máquina/);
      await screen.findByText(/Você paga agora/);

      await pagar();

      expect(await screen.findByRole('status')).toHaveTextContent(
        'Não conseguimos atualizar o valor da próxima cobrança no Mercado Pago agora. Fale com o suporte para conferir.',
      );
    });

    it('trocar de ideia: escolher outro plano refaz a cotação, e a resposta atrasada do primeiro é ignorada', async () => {
      let responderMaquina: (cotacao: CotacaoDaTroca) => void = () => {};
      mockCotar.mockImplementation((planoId: string) =>
        planoId === 'plano-maquina'
          ? new Promise<CotacaoDaTroca>((resolve) => {
            responderMaquina = resolve;
          })
          : Promise.resolve({ ...cotacaoComCobranca, diferenca: 40, valorMensalNovo: 159.9, nomeDoPlano: 'Bancada' }),
      );
      await abrir();

      await escolher(/Máquina/);
      await escolher(/Bancada/);
      expect(await screen.findByText(/Você paga agora/)).toHaveTextContent(/R\$\s40,00/);
      await act(async () => {
        responderMaquina(cotacaoComCobranca);
      });

      expect(mockCotar).toHaveBeenCalledTimes(2);
      expect(screen.getByText(/Você paga agora/)).toHaveTextContent(/R\$\s40,00/);
      expect(screen.getByRole('button', { name: /^Pagar R\$\s40,00$/ })).toBeInTheDocument();
    });

    it('no último dia do período a conta é de 1 de 30 dias', async () => {
      mockCotar.mockResolvedValue({ ...cotacaoComCobranca, diferenca: 1, diasRestantes: 1 });
      await abrir();

      await escolher(/Máquina/);

      expect(await screen.findByText(/Você paga agora/)).toHaveTextContent('proporcional ao que falta do período (1 de 30 dias)');
    });

    it('com o pagamento em andamento não dá para trocar de plano nem cancelar', async () => {
      mockCotar.mockResolvedValue(cotacaoComCobranca);
      mockTrocar.mockImplementation(() => new Promise(() => {}));
      await abrir();
      await escolher(/Máquina/);
      await screen.findByText(/Você paga agora/);

      await pagar();

      await waitFor(() => expect(mockTrocar).toHaveBeenCalledTimes(1));
      expect(screen.getByRole('button', { name: /Bancada/ })).toBeDisabled();
      expect(screen.getByRole('button', { name: /Máquina/ })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    });

    it('cancelar o pagamento volta à lista de planos, sem cobrar', async () => {
      mockCotar.mockResolvedValue(cotacaoComCobranca);
      await abrir();
      await escolher(/Máquina/);
      await screen.findByText(/Você paga agora/);

      await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

      expect(screen.queryByText(/Você paga agora/)).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Nome no cartão')).not.toBeInTheDocument();
      expect(mockTrocar).not.toHaveBeenCalled();
    });
  });

  describe('sem cobrança', () => {
    it('em teste: a troca é livre, sem formulário de cartão, e confirma com um clique', async () => {
      mockCotar.mockResolvedValue(cotacaoLivreDaBancada);
      mockTrocar.mockResolvedValue({ ...trocado, cobrado: 0, planoId: bancada.id, nomeDoPlano: 'Bancada', valorMensalNovo: 159.9 });
      const { adapter, onTrocado } = await abrir(emTesteNaMaquina);

      await escolher(/Bancada/);

      expect(await screen.findByText(/Em teste a troca é livre/)).toHaveTextContent('não cobra nada');
      expect(screen.queryByLabelText('Nome no cartão')).not.toBeInTheDocument();
      expect(adapter.montados).toHaveLength(0);

      await userEvent.click(screen.getByRole('button', { name: 'Trocar para Bancada' }));

      await waitFor(() => expect(mockTrocar).toHaveBeenCalledWith('plano-bancada', undefined));
      const aviso = await screen.findByRole('status');
      expect(aviso).toHaveTextContent('Plano trocado para Bancada.');
      expect(aviso).not.toHaveTextContent('Cobramos');
      expect(onTrocado).toHaveBeenCalledTimes(1);
    });

    it('diferença pequena demais para o Mercado Pago cobrar: o plano troca sem cobrança e sem cartão', async () => {
      mockCotar.mockResolvedValue({ ...cotacaoComCobranca, modo: 'sem_cobranca', diferenca: 0 });
      mockTrocar.mockResolvedValue({ ...trocado, cobrado: 0 });
      await abrir();

      await escolher(/Máquina/);

      expect(await screen.findByText(/pequena demais para cobrar agora/)).toBeInTheDocument();
      expect(screen.queryByLabelText('Nome no cartão')).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Trocar para Máquina' }));
      await waitFor(() => expect(mockTrocar).toHaveBeenCalledWith('plano-maquina', undefined));
    });

    it('a troca livre recusada mostra o motivo e fica na lista para tentar de novo', async () => {
      mockCotar.mockResolvedValue({ ...cotacaoLivre, nomeDoPlano: 'Tesoura', valorMensalNovo: 59.9 });
      mockTrocar.mockRejectedValue(new Error('Seus profissionais ativos não cabem no plano escolhido.'));
      await abrir(emTesteNaMaquina);
      await escolher(/Tesoura/);
      await userEvent.click(await screen.findByRole('button', { name: 'Trocar para Tesoura' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('Seus profissionais ativos não cabem no plano escolhido.');
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
  });

  describe('quando a cotação falha', () => {
    it('mostra o motivo que a função deu (plano que não cabe, assinatura recusada...) e não abre o formulário', async () => {
      mockCotar.mockRejectedValue(new Error('Seus 3 profissionais ativos não cabem no plano Tesoura, que aceita até 1.'));
      const { adapter } = await abrir(emTesteNaMaquina);

      await escolher(/Tesoura/);

      expect(await screen.findByRole('alert')).toHaveTextContent('Seus 3 profissionais ativos não cabem no plano Tesoura');
      expect(screen.queryByRole('button', { name: /^Pagar/ })).not.toBeInTheDocument();
      expect(adapter.montados).toHaveLength(0);
    });

    it('escolher outro plano depois da falha limpa o erro', async () => {
      mockCotar.mockRejectedValueOnce(new Error('Não foi possível calcular a troca de plano. Tente de novo.'));
      mockCotar.mockResolvedValueOnce(cotacaoLivreDaBancada);
      await abrir(emTesteNaMaquina);
      await escolher(/Tesoura/);
      await screen.findByRole('alert');

      await escolher(/Bancada/);

      expect(await screen.findByText(/Em teste a troca é livre/)).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('depois de trocar', () => {
    it('"Fechar" volta ao botão; o botão abre a lista de novo', async () => {
      mockCotar.mockResolvedValue(cotacaoLivreDaBancada);
      mockTrocar.mockResolvedValue({ ...trocado, cobrado: 0, planoId: bancada.id, nomeDoPlano: 'Bancada', valorMensalNovo: 159.9 });
      await abrir(emTesteNaMaquina);
      await escolher(/Bancada/);
      await userEvent.click(await screen.findByRole('button', { name: 'Trocar para Bancada' }));
      const aviso = await screen.findByRole('status');

      await userEvent.click(within(aviso).getByRole('button', { name: 'Fechar' }));

      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Mudar de plano' })).toBeInTheDocument();
    });
  });
});
