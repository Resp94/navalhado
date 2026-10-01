import React, { useState } from 'react';
import { Button } from '../ui';
import { ConfirmDialog } from '../ui/feedback/ConfirmDialog';
import { dataCompleta, fimDoAcessoAoCancelar } from '../../modules/assinatura/apresentacaoDaAssinatura';
import type { AssinaturaCancelavel } from '../../modules/assinatura/types';
import { useCancelarAssinatura } from '../../modules/assinatura/useCancelarAssinatura';

interface CancelarAssinaturaProps {
  /** O que se cancela: a situação e as datas decidem o que a pergunta diz. */
  assinatura: AssinaturaCancelavel;
  /** Fuso da barbearia, para a data do fim do acesso. Por padrão, Brasília. */
  timezone?: string;
  /** Chamado depois de a assinatura ser cancelada: a tela relê a assinatura e o layout relê o Estado de Acesso. */
  onCancelada?: () => void;
}

/** O que a pergunta diz sobre a cobrança e sobre o acesso, conforme a situação. */
function textosDoCancelamento(assinatura: AssinaturaCancelavel, timezone?: string): { cobranca: string; acesso: string } {
  // Bloqueada (tela de bloqueio): o Mercado Pago ainda cobraria no mês seguinte, e o acesso não volta por cancelar.
  if (assinatura.situacao === 'blocked') {
    return {
      cobranca: 'A assinatura que ainda está ativa no Mercado Pago é cancelada e nada mais será cobrado.',
      acesso: 'O acesso da barbearia continua bloqueado. Para voltar a usar o Navalhado, é só assinar de novo.',
    };
  }

  const emTeste = assinatura.situacao === 'trialing';
  const fimDoAcesso = fimDoAcessoAoCancelar(assinatura);

  // Em teste ou na assinatura nova de uma cancelada, a primeira cobrança ainda não aconteceu: não há o que reembolsar.
  const cobranca = emTeste
    ? 'A assinatura no Mercado Pago é cancelada e nada será cobrado no fim do teste.'
    : assinatura.assinaturaNovaAutorizada
      ? 'A assinatura nova no Mercado Pago é cancelada e nada será cobrado no fim do período pago.'
      : 'A cobrança da assinatura para agora. O que você já pagou não é reembolsado.';
  const acesso = fimDoAcesso
    ? `${emTeste ? 'Você continua no período de teste' : 'Você continua usando o Navalhado'} até ${dataCompleta(fimDoAcesso, timezone)}. Depois dessa data o acesso é bloqueado.`
    : `${emTeste ? 'O período de teste' : 'O período pago'} já acabou, então o acesso é bloqueado agora.`;

  return { cobranca, acesso };
}

/**
 * Cancelar a assinatura (spec 052, ticket 12). A cobrança para na hora e o acesso continua até o fim do período já pago; por isso a
 * pergunta diz até quando, e diz também quando não há período a esperar (o acesso é bloqueado na hora). Os dados da barbearia ficam
 * guardados e dá para assinar de novo. Em teste com o cartão autorizado, cancelar só impede a primeira cobrança: o teste segue. Na
 * cancelada que já assinou de novo, cancela a assinatura nova. Na tela de bloqueio (situação bloqueada) cancela a assinatura que o
 * Mercado Pago ainda cobra, e o acesso segue bloqueado.
 */
export const CancelarAssinatura: React.FC<CancelarAssinaturaProps> = ({ assinatura, timezone, onCancelada }) => {
  const { cancelar, cancelando, erro, limparErro } = useCancelarAssinatura();
  const [aberta, setAberta] = useState(false);
  const [cancelada, setCancelada] = useState(false);

  const fechar = () => {
    setAberta(false);
    limparErro();
  };

  const confirmar = async () => {
    if (!(await cancelar())) return;
    setAberta(false);
    // O aviso fica na tela até a releitura da assinatura chegar; com o botão de volta, um clique nessa janela levaria uma recusa
    // ("já está cancelada") numa tela que está para mudar.
    setCancelada(true);
    onCancelada?.();
  };

  if (cancelada) {
    return (
      <p role="status" className="m-0 text-sm text-text-secondary">
        Assinatura cancelada.
      </p>
    );
  }

  const { cobranca, acesso } = textosDoCancelamento(assinatura, timezone);

  return (
    <>
      <div>
        <Button variant="danger-outline" onClick={() => setAberta(true)}>
          Cancelar assinatura
        </Button>
      </div>
      <ConfirmDialog
        isOpen={aberta}
        onClose={fechar}
        onConfirm={() => void confirmar()}
        title="Cancelar a assinatura?"
        variant="warning"
        confirmText="Sim, cancelar a assinatura"
        cancelText="Manter assinatura"
        loading={cancelando}
        description={
          <div className="flex flex-col gap-2">
            <p className="m-0">{cobranca}</p>
            <p className="m-0">{acesso}</p>
            {erro && (
              <p role="alert" className="m-0 text-error">
                {erro}
              </p>
            )}
          </div>
        }
        warningText="Os dados da sua barbearia continuam guardados. Para voltar a usar o Navalhado, é só assinar de novo."
      />
    </>
  );
};
