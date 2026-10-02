import React, { useState } from 'react';
import { Button } from '../ui';
import { AceiteDosTermos } from './AceiteDosTermos';

interface PedidoDeAceiteDosTermosProps {
  /** O aceite está sendo gravado. */
  aceitando: boolean;
  /** Por que o aceite não foi gravado, para o Gerente tentar de novo. */
  erro: string | null;
  onAceitar: () => void;
}

/**
 * O pedido de aceite (spec 052, ticket 16): "Li e aceito" com os links dos textos, o erro de gravar o aceite e o botão "Aceitar e
 * continuar", travado até o Gerente marcar a caixa. Fica na tela de aceite e, no lugar do "Pagar", na tela de bloqueio.
 */
export const PedidoDeAceiteDosTermos: React.FC<PedidoDeAceiteDosTermosProps> = ({ aceitando, erro, onAceitar }) => {
  const [aceitou, setAceitou] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <AceiteDosTermos aceitou={aceitou} onChange={setAceitou} disabled={aceitando} />

      {erro && (
        <p role="alert" className="m-0 text-sm text-error">
          {erro}
        </p>
      )}

      <Button fullWidth disabled={!aceitou} loading={aceitando} onClick={onAceitar}>
        {aceitando ? 'Registrando…' : 'Aceitar e continuar'}
      </Button>
    </div>
  );
};
