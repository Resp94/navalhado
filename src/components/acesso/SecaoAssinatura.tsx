import React from 'react';
import { Button } from '../ui';
import { BotaoAssinar } from './BotaoAssinar';
import { useEstadoDeAcesso } from '../../modules/assinatura/useEstadoDeAcesso';
import type { EstadoDeAcesso } from '../../modules/assinatura/types';

interface SecaoAssinaturaProps {
  /** Query string da página, para saber se o Gerente voltou do Mercado Pago. Por padrão, a da janela. */
  search?: string;
  /** Como abrir o link do Mercado Pago. Por padrão, navega na mesma aba. */
  abrirLink?: (url: string) => void;
}

const dataCurta = (data: Date | null): string =>
  data ? data.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '';

const diasEmTexto = (dias: number): string => `${dias} ${dias === 1 ? 'dia' : 'dias'}`;

/** Texto da situação e o rótulo do botão, quando cabe assinar. */
const descrever = (estado: EstadoDeAcesso, diasRestantes: number | null): { texto: string; botao: string | null } => {
  switch (estado.motivo) {
    case 'trial':
      return {
        texto: `Você está no período de teste${diasRestantes !== null ? ` (restam ${diasEmTexto(diasRestantes)})` : ''}. Assine agora: a primeira cobrança só acontece no fim do teste, e o Mercado Pago mostra os dias grátis que restam.`,
        botao: 'Assinar',
      };
    case 'canceled':
      return {
        texto: `Assinatura cancelada. O acesso continua até ${dataCurta(estado.dataRelevante)}. Assine de novo para não perder o acesso.`,
        botao: 'Assinar de novo',
      };
    case 'payment_failed':
      return { texto: 'Há uma cobrança pendente na sua assinatura. Atualize o cartão para regularizar.', botao: null };
    case 'courtesy':
      return { texto: 'Sua barbearia está com uma cortesia: não há cobrança.', botao: null };
    case 'active':
      return { texto: 'Assinatura ativa.', botao: null };
    default:
      return { texto: '', botao: null };
  }
};

/**
 * Seção Assinatura mínima de Configurações (spec 052, ticket 05): a situação e o botão que
 * leva o Gerente à página de pagamento do Mercado Pago. A tela completa (plano, próxima
 * cobrança, histórico) é o ticket 06.
 */
export const SecaoAssinatura: React.FC<SecaoAssinaturaProps> = ({ search = window.location.search, abrirLink }) => {
  const { estado, diasRestantes, recarregar } = useEstadoDeAcesso();
  const voltandoDoPagamento = new URLSearchParams(search).get('assinatura') === 'retorno';

  if (!estado) return null;
  const { texto, botao } = descrever(estado, diasRestantes);
  if (!texto) return null;

  return (
    <section className="card card-config bg-bg-secondary border border-border rounded-lg p-8 shadow-sm flex flex-col gap-4 max-sm:p-4 max-sm:rounded-md">
      <div className="border-b border-border pb-4">
        <h3 className="text-base font-extrabold m-0 text-text-primary">Assinatura</h3>
      </div>

      {voltandoDoPagamento && estado.motivo === 'active' && (
        <div role="status" className="rounded-md border border-border p-4">
          <p className="m-0 text-sm">Pagamento confirmado. Sua assinatura está ativa.</p>
        </div>
      )}

      {voltandoDoPagamento && estado.motivo !== 'active' && (
        <div role="status" className="flex flex-col gap-2 rounded-md border border-border p-4">
          <p className="m-0 text-sm">
            Voltamos do Mercado Pago. Estamos confirmando sua assinatura; a situação abaixo muda quando o Mercado Pago avisar.
            Durante o teste, a primeira cobrança só acontece no fim dele.
          </p>
          <div>
            <Button variant="outline" size="sm" onClick={recarregar}>
              Atualizar situação
            </Button>
          </div>
        </div>
      )}

      <p className="text-sm text-text-primary m-0">{texto}</p>
      {botao && (
        <div>
          <BotaoAssinar rotulo={botao} abrirLink={abrirLink} />
        </div>
      )}
    </section>
  );
};
