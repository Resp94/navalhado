import React from 'react';
import { formatCurrency } from '../../lib/currency';
import { Button } from '../ui';
import { dataCurta } from '../../modules/assinatura/apresentacaoDaAssinatura';
import type { DetalhesDaAssinatura } from '../../modules/assinatura/types';
import { useDesfazerDescida } from '../../modules/assinatura/useDesfazerDescida';

interface DescidaAgendadaProps {
  /** O plano menor que passa a valer na próxima cobrança. */
  planoAgendado: NonNullable<DetalhesDaAssinatura['planoAgendado']>;
  /** Quando ele passa a valer: o fim do período pago. */
  dataDaMudanca: Date;
  /** Fuso da barbearia, para a data. Por padrão, Brasília. */
  timezone?: string;
  /** Chamado depois de a descida ser desfeita: a tela relê a assinatura e o aviso some. */
  onDesfeita?: () => void;
}

/**
 * A descida de plano agendada (spec 052, ticket 11): "Muda para Tesoura em 29/10", com o que isso significa e o botão para
 * desfazer antes da data. Descer não cobra nem reembolsa nada: o plano menor vale na próxima cobrança, e desde o agendamento o
 * limite dele já vale para cadastrar profissionais.
 */
export const DescidaAgendada: React.FC<DescidaAgendadaProps> = ({ planoAgendado, dataDaMudanca, timezone, onDesfeita }) => {
  const { desfazer, desfazendo, erro } = useDesfazerDescida();

  const desfazerEAvisar = async () => {
    if (await desfazer()) onDesfeita?.();
  };

  return (
    <div role="group" aria-label="Descida de plano agendada" className="flex flex-col gap-2 rounded-md border border-border p-4">
      <p className="m-0 text-sm font-semibold text-text-primary">
        {`Muda para ${planoAgendado.nome} em ${dataCurta(dataDaMudanca, timezone)}`}
      </p>
      <p className="m-0 text-sm text-text-secondary">
        {`Até lá você continua no plano atual. A próxima cobrança é de ${formatCurrency(planoAgendado.preco)}. O limite do plano menor já vale para cadastrar profissionais.`}
      </p>
      {erro && (
        <p role="alert" className="m-0 text-sm text-error">
          {erro}
        </p>
      )}
      <div>
        <Button variant="outline" size="sm" onClick={() => void desfazerEAvisar()} loading={desfazendo}>
          Desfazer
        </Button>
      </div>
    </div>
  );
};
