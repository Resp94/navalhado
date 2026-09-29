import React from 'react';
import { buildWhatsAppUrl } from '../../lib/whatsapp';

interface AgendamentoOnlineIndisponivelProps {
  tenantName?: string | null;
  tenantPhone?: string | null;
  /**
   * `pagina`: quem tenta agendar e não pode. `aviso`: quem já tem horários marcados e ainda
   * pode cancelá-los (spec 052, ticket 04: barbearia bloqueada por assinatura).
   */
  variante?: 'pagina' | 'aviso';
}

export const AgendamentoOnlineIndisponivel: React.FC<AgendamentoOnlineIndisponivelProps> = ({
  tenantName,
  tenantPhone,
  variante = 'pagina',
}) => {
  if (variante === 'aviso') {
    return (
      <section
        role="status"
        className="w-full box-border rounded-2xl border border-warning bg-warning-bg p-4 my-2 flex flex-col gap-1"
      >
        <h2 className="text-sm font-extrabold text-text-primary m-0">Agendamento online indisponível</h2>
        <p className="text-xs text-text-secondary m-0">
          O agendamento online está indisponível no momento. Você ainda pode cancelar os horários que já marcou.
        </p>
      </section>
    );
  }

  const contato = tenantPhone ? buildWhatsAppUrl(tenantPhone) : '';

  return (
    <section className="w-full box-border rounded-2xl border border-border bg-white p-6 mt-6 flex flex-col items-center gap-3 text-center">
      <h2 className="text-lg font-extrabold text-text-primary m-0">Agendamento online indisponível</h2>
      <p className="text-sm text-text-secondary m-0">
        {tenantName || 'Esta barbearia'} não está recebendo agendamentos online no momento. Entre em contato
        diretamente com o estabelecimento.
      </p>
      {contato && (
        <a
          href={contato}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Falar com a barbearia pelo WhatsApp"
          className="mt-1 py-2 px-4 rounded-full bg-[#D96C00] text-white text-xs font-bold shadow-xs hover:bg-[#9C3F00] transition-colors no-underline"
        >
          Falar pelo WhatsApp
        </a>
      )}
    </section>
  );
};
