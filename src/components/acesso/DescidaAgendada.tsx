import React, { useState } from 'react';
import { formatCurrency } from '../../lib/currency';
import { Button } from '../ui';
import { dataCurta } from '../../modules/assinatura/apresentacaoDaAssinatura';
import type { DetalhesDaAssinatura } from '../../modules/assinatura/types';
import { useDesfazerDescida } from '../../modules/assinatura/useDesfazerDescida';

interface DescidaAgendadaProps {
  /** O plano menor que passa a valer na próxima cobrança. */
  planoAgendado: NonNullable<DetalhesDaAssinatura['planoAgendado']>;
  /**
   * Quando ele passa a valer: o fim do período pago. Sem data (o período venceu e o aviso da mensalidade ainda não chegou, ou o
   * pagamento foi recusado e o Mercado Pago tenta de novo), vale na próxima cobrança aprovada.
   */
  dataDaMudanca?: Date | null;
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
  const [desfeita, setDesfeita] = useState(false);

  const desfazerEAvisar = async () => {
    if (await desfazer()) {
      // O aviso fica na tela até a releitura da assinatura chegar; sem o botão não há como pedir de novo e levar um 409.
      setDesfeita(true);
      onDesfeita?.();
    }
  };

  return (
    <div role="group" aria-label="Descida de plano agendada" className="flex flex-col gap-2 rounded-md border border-border p-4">
      <p className="m-0 text-sm font-semibold text-text-primary">
        {dataDaMudanca
          ? `Muda para ${planoAgendado.nome} em ${dataCurta(dataDaMudanca, timezone)}`
          : `Muda para ${planoAgendado.nome} na próxima cobrança aprovada`}
      </p>
      <p className="m-0 text-sm text-text-secondary">
        {`Até lá você continua no plano atual. A próxima cobrança é de ${formatCurrency(planoAgendado.preco)}. O limite do plano menor já vale para cadastrar profissionais.`}
      </p>
      {erro && (
        <p role="alert" className="m-0 text-sm text-error">
          {erro}
        </p>
      )}
      {desfeita ? (
        <p role="status" className="m-0 text-sm text-text-secondary">
          Descida desfeita.
        </p>
      ) : (
        <div>
          <Button variant="outline" size="sm" onClick={() => void desfazerEAvisar()} loading={desfazendo}>
            Desfazer
          </Button>
        </div>
      )}
    </div>
  );
};
