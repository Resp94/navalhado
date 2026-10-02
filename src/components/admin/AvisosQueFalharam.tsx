import React from 'react';
import { dataCompleta } from '../../modules/assinatura/apresentacaoDaAssinatura';
import { rotuloDoTipoDeAviso } from '../../modules/proprietario/apresentacao';
import { useAvisosQueFalharam } from '../../modules/proprietario/useAvisosQueFalharam';
import { Button } from '../ui';

/**
 * Os avisos por e-mail que falharam nos últimos 30 dias (esgotaram as tentativas, ou o Resend recusou), com o motivo: o Proprietário
 * percebe uma chave do Resend vencida ou um domínio sem verificação antes de o cliente reclamar (spec 052, tickets 08 e 15). Um aviso
 * que falhou nunca deixa de ter falhado: sem a janela de 30 dias o cartão não voltaria a "nenhum aviso falhou" depois de a chave ser
 * trocada. Com mais avisos do que a lista traz, o número vai com "+" e a nota diz que só os mais recentes aparecem.
 */
export const AvisosQueFalharam: React.FC = () => {
  const { avisos, haMais, status, recarregar } = useAvisosQueFalharam();

  if (status === 'loading') return null;

  if (status === 'error') {
    return (
      <div className="flex items-center gap-3">
        <p role="alert" className="m-0 text-sm text-error">
          Não foi possível ler os avisos por e-mail que falharam.
        </p>
        <Button size="sm" variant="outline" onClick={recarregar}>
          Tentar de novo
        </Button>
      </div>
    );
  }

  if (avisos.length === 0) {
    return <p className="m-0 text-sm text-text-secondary">Nenhum aviso por e-mail falhou.</p>;
  }

  return (
    <section aria-label="Avisos por e-mail que falharam" className="flex flex-col gap-3 rounded-xl border border-warning bg-warning-bg p-5">
      <h3 className="m-0 text-base font-extrabold text-text-primary">{`Avisos por e-mail que falharam (${avisos.length}${haMais ? '+' : ''})`}</h3>
      <p className="m-0 text-sm text-text-secondary">
        Dos últimos 30 dias: esgotaram as tentativas ou o Resend recusou o envio. Confira a chave do Resend e a verificação do domínio de
        envio.
        {haMais ? ` Só os ${avisos.length} mais recentes aparecem aqui.` : ''}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="text-text-secondary">
              <th className="py-2 pr-3 font-semibold">Barbearia</th>
              <th className="py-2 pr-3 font-semibold">Aviso</th>
              <th className="py-2 pr-3 font-semibold">Tentativas</th>
              <th className="py-2 pr-3 font-semibold">Motivo</th>
              <th className="py-2 font-semibold">Quando</th>
            </tr>
          </thead>
          <tbody>
            {avisos.map((aviso) => (
              <tr key={aviso.id} className="border-t border-border">
                <td className="py-2 pr-3">{aviso.barbearia ?? '—'}</td>
                <td className="py-2 pr-3">{rotuloDoTipoDeAviso(aviso.tipo)}</td>
                <td className="py-2 pr-3">{aviso.tentativas}</td>
                <td className="py-2 pr-3 break-words">{aviso.motivo ?? '—'}</td>
                <td className="py-2">{dataCompleta(aviso.criadoEm)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};
