import React from 'react';
import { formatCurrency } from '../../lib/currency';
import { Button, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui';
import { BotaoAssinar } from './BotaoAssinar';
import { MudarDePlano } from './MudarDePlano';
import { TrocarCartao } from './TrocarCartao';
import {
  autorizadaEmTeste,
  dataCompleta,
  descreverSituacao,
  pagamentoConfirmado,
  proximaCobranca,
  rotuloDaSituacaoDaCobranca,
  rotuloDoCartao,
  rotuloDoTipoDaCobranca,
} from '../../modules/assinatura/apresentacaoDaAssinatura';
import type { SituacaoDaAssinatura } from '../../modules/assinatura/situacaoDaAssinatura';
import { useMinhaAssinatura } from '../../modules/assinatura/useMinhaAssinatura';
import { useRetornoDoPagamento } from '../../modules/assinatura/useRetornoDoPagamento';

interface SecaoAssinaturaProps {
  /** Barbearia do Gerente: de quem se lê a assinatura e o histórico. */
  tenantId: string;
  /** Fuso da barbearia, para as datas. Por padrão, Brasília. */
  timezone?: string;
  /** Query string da página, para saber se o Gerente voltou do Mercado Pago. Por padrão, a da janela. */
  search?: string;
  /** Como abrir o link do Mercado Pago. Por padrão, navega na mesma aba. */
  abrirLink?: (url: string) => void;
}

/** O que a tela diz e oferece em cada situação. Só quem não tem assinatura ativa vê o botão. */
interface Orientacao {
  texto?: string;
  botao?: string;
}

const ORIENTACAO: Record<SituacaoDaAssinatura, Orientacao> = {
  trialing: {
    texto: 'A primeira cobrança só acontece no fim do teste, e o Mercado Pago mostra os dias grátis que restam.',
    botao: 'Assinar',
  },
  active: {},
  past_due: { texto: 'Há uma cobrança pendente na sua assinatura. Atualize o cartão para regularizar.' },
  canceled: { texto: 'Assine de novo para não perder o acesso.', botao: 'Assinar de novo' },
  courtesy: { texto: 'Sua barbearia está com uma cortesia: não há cobrança.' },
  blocked: { botao: 'Assinar' },
};

const CARD_CLASSES =
  'card card-config bg-bg-secondary border border-border rounded-lg p-8 shadow-sm flex flex-col gap-4 max-sm:p-4 max-sm:rounded-md';

/**
 * Tela Assinatura de Configurações (spec 052, tickets 05 e 06): plano, situação, próxima
 * cobrança, cartão e histórico de cobranças da barbearia, e o botão que leva o Gerente à página
 * de pagamento do Mercado Pago quando não há assinatura ativa. O histórico é o que o webhook
 * gravou; a tela não consulta o Mercado Pago.
 */
export const SecaoAssinatura: React.FC<SecaoAssinaturaProps> = ({
  tenantId,
  timezone,
  search = window.location.search,
  abrirLink,
}) => {
  const { assinatura, cobrancas, status, historicoIndisponivel, diasRestantes, recarregar } =
    useMinhaAssinatura(tenantId);
  // Voltando do Mercado Pago, o webhook pode chegar depois: relê até o pagamento aparecer.
  const voltandoDoPagamento = useRetornoDoPagamento(
    search,
    assinatura !== null && !pagamentoConfirmado(assinatura),
    recarregar,
  );

  if (status === 'loading') return null;

  const cabecalho = (
    <div className="border-b border-border pb-4">
      <h3 className="text-base font-extrabold m-0 text-text-primary">Assinatura</h3>
    </div>
  );

  if (status === 'error') {
    return (
      <section className={CARD_CLASSES}>
        {cabecalho}
        <p className="text-sm text-text-primary m-0">Não foi possível carregar a assinatura.</p>
        <div>
          <Button variant="outline" size="sm" onClick={recarregar}>
            Tentar de novo
          </Button>
        </div>
      </section>
    );
  }

  if (!assinatura) {
    return (
      <section className={CARD_CLASSES}>
        {cabecalho}
        <p className="text-sm text-text-primary m-0">Sua barbearia está sem assinatura.</p>
      </section>
    );
  }

  // Com o cartão já autorizado a assinatura existe no Mercado Pago: "Assinar" de novo só levaria a uma recusa.
  const emTesteAutorizado = autorizadaEmTeste(assinatura);
  const { texto, botao }: Orientacao = emTesteAutorizado ? {} : ORIENTACAO[assinatura.situacao];
  const cobrancaMarcada = proximaCobranca(assinatura);
  const cartao = rotuloDoCartao(assinatura.cartao);
  // O cartão só existe (e só cobra) na assinatura ativa, recusada ou em teste já autorizada.
  const podeTrocarOCartao =
    assinatura.situacao === 'active' || assinatura.situacao === 'past_due' || emTesteAutorizado;

  return (
    <section className={CARD_CLASSES}>
      {cabecalho}

      {voltandoDoPagamento && assinatura.situacao === 'active' && (
        <div role="status" className="rounded-md border border-border p-4">
          <p className="m-0 text-sm">Pagamento confirmado. Sua assinatura está ativa.</p>
        </div>
      )}

      {voltandoDoPagamento && emTesteAutorizado && (
        <div role="status" className="rounded-md border border-border p-4">
          <p className="m-0 text-sm">Assinatura autorizada no Mercado Pago. A primeira cobrança acontece no fim do teste.</p>
        </div>
      )}

      {voltandoDoPagamento && !pagamentoConfirmado(assinatura) && (
        <div role="status" className="flex flex-col gap-2 rounded-md border border-border p-4">
          <p className="m-0 text-sm">
            Voltamos do Mercado Pago. Estamos confirmando sua assinatura; a situação abaixo muda quando o Mercado Pago avisar.
          </p>
          <div>
            <Button variant="outline" size="sm" onClick={recarregar}>
              Atualizar situação
            </Button>
          </div>
        </div>
      )}

      <dl className="m-0 grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm max-sm:grid-cols-1 max-sm:gap-y-0">
        <dt className="text-text-secondary max-sm:mt-2">Plano</dt>
        <dd className="m-0 font-semibold text-text-primary">
          {`${assinatura.plano.nome}, ${formatCurrency(assinatura.plano.preco)} por mês`}
        </dd>

        <dt className="text-text-secondary max-sm:mt-2">Situação</dt>
        <dd className="m-0 font-semibold text-text-primary">{descreverSituacao(assinatura, diasRestantes, timezone)}</dd>

        {cobrancaMarcada && (
          <>
            <dt className="text-text-secondary max-sm:mt-2">Próxima cobrança</dt>
            <dd className="m-0 font-semibold text-text-primary">
              {`${formatCurrency(cobrancaMarcada.valor)} em ${dataCompleta(cobrancaMarcada.data, timezone)}`}
            </dd>
          </>
        )}

        {cartao && (
          <>
            <dt className="text-text-secondary max-sm:mt-2">Cartão</dt>
            <dd className="m-0 font-semibold text-text-primary">{cartao}</dd>
          </>
        )}
      </dl>

      {texto && <p className="text-sm text-text-secondary m-0">{texto}</p>}

      {/* Aqui entram as ações da assinatura, cada uma no seu ticket: descer de plano (11), cancelar (12) e exportar os dados (14). */}
      {botao && (
        <div>
          <BotaoAssinar rotulo={botao} abrirLink={abrirLink} />
        </div>
      )}

      {podeTrocarOCartao && (
        <TrocarCartao cobrancaPendente={assinatura.situacao === 'past_due'} onTrocado={recarregar} />
      )}

      {/* Em teste a troca de plano é livre; na assinatura ativa, só se sobe. Nas outras situações não há plano a mudar. */}
      {(assinatura.situacao === 'active' || assinatura.situacao === 'trialing') && (
        <MudarDePlano assinatura={assinatura} onTrocado={recarregar} />
      )}

      <div className="flex flex-col gap-3 border-t border-border pt-4">
        <h4 className="text-sm font-extrabold m-0 text-text-primary">Histórico de cobranças</h4>

        {historicoIndisponivel && (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-text-primary m-0">Não foi possível carregar o histórico de cobranças.</p>
            <div>
              <Button variant="outline" size="sm" onClick={recarregar}>
                Tentar de novo
              </Button>
            </div>
          </div>
        )}

        {!historicoIndisponivel && cobrancas.length === 0 && (
          <p className="text-sm text-text-secondary m-0">Nenhuma cobrança até agora.</p>
        )}

        {cobrancas.length > 0 && (
          <Table aria-label="Histórico de cobranças">
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead align="right">Valor</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Cartão</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cobrancas.map((cobranca) => (
                <TableRow key={cobranca.id}>
                  <TableCell className="whitespace-nowrap">{dataCompleta(cobranca.cobradaEm, timezone)}</TableCell>
                  <TableCell align="right" className="whitespace-nowrap">{formatCurrency(cobranca.valor)}</TableCell>
                  <TableCell>{rotuloDaSituacaoDaCobranca(cobranca.situacao)}</TableCell>
                  <TableCell className="whitespace-nowrap">{rotuloDoTipoDaCobranca(cobranca.tipo)}</TableCell>
                  <TableCell className="whitespace-nowrap">{rotuloDoCartao(cobranca.cartao) ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </section>
  );
};
