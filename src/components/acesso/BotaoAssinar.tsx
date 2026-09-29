import React from 'react';
import { Button } from '../ui';
import { useAssinar } from '../../modules/assinatura/useAssinar';

interface BotaoAssinarProps {
  /** "Assinar" em Configurações; "Pagar" na tela de bloqueio. */
  rotulo?: string;
  fullWidth?: boolean;
  /** Como abrir o link do Mercado Pago. Por padrão, navega na mesma aba. */
  abrirLink?: (url: string) => void;
}

/** Cria a assinatura no Mercado Pago e abre a página de pagamento (spec 052, ticket 05). */
export const BotaoAssinar: React.FC<BotaoAssinarProps> = ({ rotulo = 'Assinar', fullWidth, abrirLink }) => {
  const { assinar, assinando, erro } = useAssinar(abrirLink);

  return (
    <div className="flex flex-col gap-2">
      <Button fullWidth={fullWidth} loading={assinando} onClick={assinar}>
        {rotulo}
      </Button>
      {erro && (
        <p role="alert" className="text-sm text-error m-0">
          {erro}
        </p>
      )}
    </div>
  );
};
