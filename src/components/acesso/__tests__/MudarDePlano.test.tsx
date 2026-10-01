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
// ativa o Gerente que sobe vê a diferença proporcional e o valor mensal novo ANTES de confirmar e paga a
// diferença no cartão digitado nos campos seguros. Recusado, o plano continua o mesmo. Ticket 11: descer na
// assinatura ativa não cobra nada: agenda o plano menor para a próxima cobrança, sem reembolso.

const CPF_VALIDO = '529.982.247-25';

const tesoura: Plano = { id: 'plano-tesoura', name: 'Tesoura', price: 59.9, max_professionals: 1 };
const maquina: Plano = { id: 'plano-maquina', name: 'Máquina', price: 89.9, max_professionals: 5 };
const bancada: Plano = { id: 'plano-bancada', name: 'Bancada', price: 159.9, max_professionals: 10 };

type Assinatura = React.ComponentProps<typeof MudarDePlano>['assinatura'];
const ativaNaTesoura: Assinatura = { situacao: 'active', plano: { id: tesoura.id, nome: 'Tesoura', preco: 59.9 } };
const emTesteNaMaquina: Assinatura = { situacao: 'trialing', plano: { id: maquina.id, nome: 'Máquina', preco: 89.9 } };
const ativaNaMaquina: Assinatura = { situacao: 'active', plano: { id: maquina.id, nome: 'Máquina', preco: 89.9 } };
const ativaNaBancada: Assinatura = { situacao: 'active', plano: { id: bancada.id, nome: 'Bancada', preco: 159.9 } };

const cotacaoComCobranca: CotacaoDaTroca = {
  modo: 'cobranca',
  diferenca: 20,
  valorMensalNovo: 89.9,
  diasRestantes: 20,
  diasDoPeriodo: 30,
  nomeDoPlano: 'Máquina',
  vigenteEm: null,
};
const cotacaoAgendada: CotacaoDaTroca = {
  modo: 'agendada',
  diferenca: 0,
  valorMensalNovo: 59.9,
  diasRestantes: null,
  diasDoPeriodo: null,
  nomeDoPlano: 'Tesoura',
  vigenteEm: new Date('2026-10-29T23:26:22Z'),
};
const agendado: PlanoTrocado = {
  planoId: tesoura.id,
  nomeDoPlano: 'Tesoura',
  cobrado: 0,
  valorMensalNovo: 59.9,
  proximaCobrancaAtualizada: true,
  vigenteEm: new Date('2026-10-29T23:26:22Z'),
};
const cotacaoLivre: CotacaoDaTroca = { ...cotacaoComCobranca, modo: 'livre', diferenca: 0, diasRestantes: null, diasDoPeriodo: null };
const cotacaoLivreDaBancada: CotacaoDaTroca = { ...cotacaoLivre, nomeDoPlano: 'Bancada', valorMensalNovo: 159.9 };
const trocado: PlanoTrocado = {
  planoId: maquina.id,
  nomeDoPlano: 'Máquina',
  cobrado: 20,
  valorMensalNovo: 89.9,
  proximaCobrancaAtualizada: true,
  vigenteEm: null,
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

    it('na assinatura ativa na Tesoura oferece os planos mais caros, para subir', async () => {
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

    it('na assinatura ativa oferece também os planos mais baratos, para descer na próxima cobrança', async () => {
      await abrir(ativaNaMaquina);

      expect(screen.getByRole('button', { name: /Tesoura/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Bancada/ })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Máquina/ })).not.toBeInTheDocument();
    });

    it('no maior plano da assinatura ativa só há para onde descer', async () => {
      await abrir(ativaNaBancada);

      expect(screen.getByRole('button', { name: /Tesoura/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Máquina/ })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Bancada/ })).not.toBeInTheDocument();
    });

    it('o plano da descida que já está agendada não é oferecido de novo', async () => {
      await abrir({ ...ativaNaMaquina, planoAgendado: { id: tesoura.id, nome: 'Tesoura', preco: 59.9 } });

      expect(screen.queryByRole('button', { name: /Tesoura/ })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Bancada/ })).toBeInTheDocument();
    });

    it('sem nenhum outro plano no catálogo não oferece a troca', () => {
      comCatalogo('ready', [maquina]);
      renderizar(ativaNaMaquina);

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

    // Subir de plano desfaz a descida agendada (o banco limpa o agendamento ao trocar, e o valor da assinatura vai para o do plano
    // novo): o resumo avisa antes de pagar e o aviso diz depois, em vez de a descida sumir sem o Gerente saber.
    const maquinaComTesouraAgendada: Assinatura = {
      ...ativaNaMaquina,
      planoAgendado: { id: tesoura.id, nome: 'Tesoura', preco: 59.9 },
    };
    const cotacaoParaABancada: CotacaoDaTroca = { ...cotacaoComCobranca, nomeDoPlano: 'Bancada', valorMensalNovo: 159.9 };

    it('com uma descida agendada, o resumo da subida avisa que ela será desfeita', async () => {
      mockCotar.mockResolvedValue(cotacaoParaABancada);
      await abrir(maquinaComTesouraAgendada);

      await escolher(/Bancada/);

      expect(await screen.findByText(/Você paga agora/)).toBeInTheDocument();
      expect(screen.getByText('A descida agendada para o plano Tesoura será desfeita.')).toBeInTheDocument();
    });

    it('depois de pagar, o aviso diz que a descida agendada foi desfeita', async () => {
      mockCotar.mockResolvedValue(cotacaoParaABancada);
      mockTrocar.mockResolvedValue({ ...trocado, planoId: bancada.id, nomeDoPlano: 'Bancada', valorMensalNovo: 159.9 });
      await abrir(maquinaComTesouraAgendada);
      await escolher(/Bancada/);
      await screen.findByText(/Você paga agora/);

      await pagar();

      const aviso = await screen.findByRole('status');
      expect(aviso).toHaveTextContent('Plano trocado para Bancada.');
      expect(aviso).toHaveTextContent('A descida agendada para o plano Tesoura foi desfeita.');
    });

    it('sem descida agendada, o resumo e o aviso da subida não falam dela', async () => {
      mockCotar.mockResolvedValue(cotacaoComCobranca);
      mockTrocar.mockResolvedValue(trocado);
      await abrir();
      await escolher(/Máquina/);
      await screen.findByText(/Você paga agora/);
      expect(screen.queryByText(/A descida agendada/)).not.toBeInTheDocument();

      await pagar();

      expect(await screen.findByRole('status')).not.toHaveTextContent('descida');
    });

    it('subir sem cobrança (diferença pequena demais) também avisa que a descida agendada será desfeita', async () => {
      mockCotar.mockResolvedValue({ ...cotacaoParaABancada, modo: 'sem_cobranca', diferenca: 0 });
      await abrir(maquinaComTesouraAgendada);

      await escolher(/Bancada/);

      expect(await screen.findByText(/pequena demais para cobrar agora/)).toBeInTheDocument();
      expect(screen.getByText('A descida agendada para o plano Tesoura será desfeita.')).toBeInTheDocument();
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
  describe('descer de plano na assinatura ativa', () => {
    it('ao escolher um plano mais barato, diz que só vale na próxima cobrança, sem reembolso, e não pede cartão', async () => {
      mockCotar.mockResolvedValue(cotacaoAgendada);
      const { adapter } = await abrir(ativaNaMaquina);

      await escolher(/Tesoura/);

      expect(mockCotar).toHaveBeenCalledWith('plano-tesoura');
      const resumo = await screen.findByText(/só vale na próxima cobrança/);
      expect(resumo).toHaveTextContent('Descer para o plano Tesoura só vale na próxima cobrança, em 29/10/2026.');
      expect(resumo).toHaveTextContent('Não há reembolso');
      expect(screen.getByText(/Até lá você continua no plano Máquina/)).toBeInTheDocument();
      expect(screen.getByText(/A partir daí o plano Tesoura custa/)).toHaveTextContent(/R\$\s59,90 por mês/);
      expect(screen.getByText(/já vale o limite do plano menor para cadastrar profissionais: 1 profissional/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Agendar descida para Tesoura' })).toBeEnabled();
      expect(screen.queryByLabelText('Nome no cartão')).not.toBeInTheDocument();
      expect(adapter.montados).toHaveLength(0);
      expect(mockTrocar).not.toHaveBeenCalled();
    });

    it('confirma com um clique, sem cartão, e avisa a data, o limite menor que já vale e o valor da próxima cobrança', async () => {
      mockCotar.mockResolvedValue(cotacaoAgendada);
      mockTrocar.mockResolvedValue(agendado);
      const { onTrocado } = await abrir(ativaNaMaquina);
      await escolher(/Tesoura/);
      await screen.findByText(/só vale na próxima cobrança/);

      await userEvent.click(screen.getByRole('button', { name: 'Agendar descida para Tesoura' }));

      await waitFor(() => expect(mockTrocar).toHaveBeenCalledWith('plano-tesoura', undefined));
      expect(mockTrocar).toHaveBeenCalledTimes(1);
      const aviso = await screen.findByRole('status');
      expect(aviso).toHaveTextContent('Descida agendada: o plano Tesoura vale a partir de 29/10/2026.');
      expect(aviso).toHaveTextContent('Até lá você continua no plano atual.');
      expect(aviso).toHaveTextContent(/O valor mensal passa a ser R\$\s59,90 na próxima cobrança\./);
      expect(aviso).toHaveTextContent('O limite do plano menor, de 1 profissional, já vale para novos cadastros.');
      expect(aviso).not.toHaveTextContent('Cobramos');
      expect(onTrocado).toHaveBeenCalledTimes(1);
    });

    it('o Mercado Pago não aceitou o valor: a função não agenda e a tela mostra o motivo, sem fechar', async () => {
      mockCotar.mockResolvedValue(cotacaoAgendada);
      mockTrocar.mockRejectedValue(new Error('Não foi possível agendar a descida de plano agora. Tente de novo em instantes.'));
      const { onTrocado } = await abrir(ativaNaMaquina);
      await escolher(/Tesoura/);
      await screen.findByText(/só vale na próxima cobrança/);

      await userEvent.click(screen.getByRole('button', { name: 'Agendar descida para Tesoura' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível agendar a descida de plano agora.');
      expect(screen.getByRole('button', { name: 'Agendar descida para Tesoura' })).toBeEnabled();
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      expect(onTrocado).not.toHaveBeenCalled();
    });

    // Só excluir libera vaga (o profissional inativo continua contando): a mensagem da função manda excluir, e a tela a repete.
    it('com mais profissionais do que o plano menor aceita, mostra o aviso de quantos excluir e não deixa agendar', async () => {
      mockCotar.mockRejectedValue(
        new Error(
          'Você tem 3 profissionais cadastrados e o plano Tesoura aceita até 1. Exclua 2 profissionais antes de trocar de plano: o profissional inativo continua ocupando vaga, só excluir libera.',
        ),
      );
      await abrir(ativaNaBancada);

      await escolher(/Tesoura/);

      expect(await screen.findByRole('alert')).toHaveTextContent('Exclua 2 profissionais antes de trocar de plano');
      expect(screen.queryByRole('button', { name: /Agendar descida/ })).not.toBeInTheDocument();
      expect(mockTrocar).not.toHaveBeenCalled();
    });

    // Com uma descida já agendada, escolher outro plano menor troca o agendamento: o resumo diz isso antes de confirmar, e o
    // aviso depois, para a descida que o Gerente tinha em mente não sumir sem ele perceber.
    it('com outra descida já agendada, o resumo diz que ela será trocada e o aviso depois diz que foi trocada', async () => {
      const bancadaComMaquinaAgendada: Assinatura = {
        ...ativaNaBancada,
        planoAgendado: { id: maquina.id, nome: 'Máquina', preco: 89.9 },
      };
      mockCotar.mockResolvedValue(cotacaoAgendada);
      mockTrocar.mockResolvedValue(agendado);
      await abrir(bancadaComMaquinaAgendada);
      await escolher(/Tesoura/);

      expect(await screen.findByText(/Isso troca a descida já agendada para o plano Máquina/)).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: 'Agendar descida para Tesoura' }));

      const aviso = await screen.findByRole('status');
      expect(aviso).toHaveTextContent('A descida que estava agendada para o plano Máquina foi trocada por esta.');
    });

    it('sem outra descida agendada, o resumo e o aviso não falam em troca de agendamento', async () => {
      mockCotar.mockResolvedValue(cotacaoAgendada);
      mockTrocar.mockResolvedValue(agendado);
      await abrir(ativaNaMaquina);
      await escolher(/Tesoura/);
      await screen.findByText(/só vale na próxima cobrança/);

      expect(screen.queryByText(/Isso troca a descida/)).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Agendar descida para Tesoura' }));
      expect(await screen.findByRole('status')).not.toHaveTextContent('foi trocada por esta');
    });

    // O aviso "Descida agendada: ..." é do que o Gerente acabou de pedir. Quando a descida é desfeita pelo "Desfazer" do aviso
    // "Muda para Tesoura" (outro componente da tela, que só relê a assinatura), o aviso daqui não pode seguir dizendo que a
    // descida está agendada, nem esconder o botão "Mudar de plano".
    it('se a descida é desfeita depois pelo Desfazer da tela, o aviso da descida some e o botão volta', async () => {
      mockCotar.mockResolvedValue(cotacaoAgendada);
      mockTrocar.mockResolvedValue(agendado);
      const repositorio = new CartaoRepository(new InMemoryCartaoAdapter());
      const comDescida: Assinatura = { ...ativaNaMaquina, planoAgendado: { id: tesoura.id, nome: 'Tesoura', preco: 59.9 } };
      const { rerender } = render(<MudarDePlano assinatura={ativaNaMaquina} repositorio={repositorio} />);
      await userEvent.click(screen.getByRole('button', { name: 'Mudar de plano' }));
      await escolher(/Tesoura/);
      await userEvent.click(await screen.findByRole('button', { name: 'Agendar descida para Tesoura' }));
      expect(await screen.findByRole('status')).toHaveTextContent('Descida agendada');

      // A tela relê a assinatura e a descida aparece nela: o aviso fica.
      rerender(<MudarDePlano assinatura={comDescida} repositorio={repositorio} />);
      expect(screen.getByRole('status')).toHaveTextContent('Descida agendada');

      // O Gerente desfaz pelo aviso "Muda para Tesoura": a assinatura volta a não ter descida agendada.
      rerender(<MudarDePlano assinatura={ativaNaMaquina} repositorio={repositorio} />);

      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Mudar de plano' })).toBeInTheDocument();
    });

    it('trocar de ideia: cancelar volta à lista sem agendar nada', async () => {
      mockCotar.mockResolvedValue(cotacaoAgendada);
      await abrir(ativaNaMaquina);
      await escolher(/Tesoura/);
      await screen.findByText(/só vale na próxima cobrança/);

      await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

      expect(screen.getByRole('button', { name: /Tesoura/ })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Agendar descida/ })).not.toBeInTheDocument();
      expect(mockTrocar).not.toHaveBeenCalled();
    });

    it('usa o fuso da barbearia para a data em que o plano menor vale', async () => {
      // 02:30 UTC de 30/10 ainda é 29/10 em Brasília e já é 30/10 em Lisboa.
      mockCotar.mockResolvedValue({ ...cotacaoAgendada, vigenteEm: new Date('2026-10-30T02:30:00Z') });
      const adapter = new InMemoryCartaoAdapter();
      render(<MudarDePlano assinatura={ativaNaMaquina} timezone="Europe/Lisbon" repositorio={new CartaoRepository(adapter)} />);
      await userEvent.click(screen.getByRole('button', { name: 'Mudar de plano' }));

      await escolher(/Tesoura/);

      expect(await screen.findByText(/só vale na próxima cobrança/)).toHaveTextContent('em 30/10/2026');
    });
  });
});
