import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../components/ui/feedback/DataTable';
import { PercentageBar } from '../../../../components/ui/data-display/PercentageBar';
import { EmptyState } from '../../../../components/ui/data-display/EmptyState';
import { formatPercent } from '../../../../modules/relatorios/formatacao';
import type {
  AcquisitionChannelItem,
  RegistrationOrigemItem,
  RelatorioClientesRegistrationOrigin,
  RelatorioClientesRegistrations,
} from '../../../../modules/relatorios/types';

/** Rótulo de exibição de cada origem do cadastro (spec 038, ticket 11). */
export const REGISTRATION_ORIGIN_LABELS: Record<RelatorioClientesRegistrationOrigin, string> = {
  balcao: 'Balcão',
  agenda: 'Agenda',
  online: 'Link público',
  canal_cliente: 'Canal do Cliente',
  whatsapp_bot: 'WhatsApp',
  importacao: 'Importação',
};

export function formatRegistrationOriginLabel(origin: string): string {
  return REGISTRATION_ORIGIN_LABELS[origin as RelatorioClientesRegistrationOrigin] ?? origin;
}

const NAO_INFORMADO = 'Não informado';

/**
 * Fração de `total` sobre `groupTotal`, `null` quando `groupTotal` é zero
 * (nunca dividido por zero) -- usada aqui para as barras de `PercentageBar`,
 * sempre `item.total / registrations.total` (nunca `item.with_visit`, que é
 * outra métrica: quantos do grupo já voltaram, não quanto do total o grupo
 * representa).
 */
function shareOf(total: number, groupTotal: number): number | null {
  return groupTotal > 0 ? total / groupTotal : null;
}

export interface ClientesOrigemDosClientesProps {
  registrations: RelatorioClientesRegistrations;
  /** Botão "Exportar CSV" da distribuição por Origem do Cadastro, injetado pela página. */
  exportOrigemButton?: React.ReactNode;
  /** Botão "Exportar CSV" da distribuição por Canal de Aquisição, injetado pela página. */
  exportCanalButton?: React.ReactNode;
}

/**
 * Seção "Origem dos clientes" da página Clientes (spec 038, ticket 11,
 * histórias 71-75): as duas distribuições dos cadastros do período lado a
 * lado -- Origem do Cadastro (automática, sempre preenchida) e Canal de
 * Aquisição (declarado, opcional) -- cada uma com barras horizontais
 * (`PercentageBar`, mesmo padrão da `FaturamentoRecebidoPorForma`) e a
 * tabela equivalente. `share` de cada barra é sempre `item.total /
 * registrations.total`, nunca `item.with_visit` (métrica diferente: quantos
 * do grupo já tiveram Visita, não a participação do grupo no total).
 *
 * "Não informado" (Further Notes "Dado ralo no canal de aquisição": no
 * banco dev todo cliente está com canal vazio) ganha destaque visual
 * próprio -- fundo diferenciado na barra e na linha da tabela -- e a seção
 * mostra `acquisition_channel_filled_share` como um destaque textual
 * separado (percentual dos cadastros do período COM canal preenchido;
 * matematicamente o complemento do share de "Não informado", mas vem
 * pronto do contrato, nunca recalculado na tela). `null` quando não há
 * cadastro no período -- a tela mostra "--", nunca "0%".
 */
export const ClientesOrigemDosClientes: React.FC<ClientesOrigemDosClientesProps> = ({
  registrations,
  exportOrigemButton,
  exportCanalButton,
}) => {
  if (registrations.total === 0) {
    return (
      <EmptyState
        title="Nenhum cadastro no período"
        description="Não há cliente com cadastro criado no período selecionado. Tente ampliar o período."
      />
    );
  }

  return (
    <div className="relatorios-origem-grid">
      <div className="relatorios-origem-coluna">
        <div className="relatorios-faturamento-secao-header">
          <div className="relatorios-faturamento-secao-titulo">
            <h4 className="card-panel-title">Origem do cadastro</h4>
            <p className="card-panel-subtitle">Por qual porta o cadastro entrou -- automática, sempre preenchida.</p>
          </div>
          {exportOrigemButton}
        </div>

        <div className="relatorios-origem-barras" role="list">
          {registrations.by_registration_origin.map((item) => {
            const share = shareOf(item.total, registrations.total);
            return (
              <div role="listitem" key={item.origin}>
                <PercentageBar
                  label={formatRegistrationOriginLabel(item.origin)}
                  value={`${item.total} · ${formatPercent(share)}`}
                  share={share}
                  trailing={`${item.with_visit} com Visita`}
                />
              </div>
            );
          })}
        </div>

        <div className="relatorios-faturamento-tabela-wrap">
          <Table aria-label="Origem do cadastro">
            <TableHeader>
              <TableRow>
                <TableHead>Origem</TableHead>
                <TableHead align="right">Cadastros</TableHead>
                <TableHead align="right">Participação</TableHead>
                <TableHead align="right">Com Visita</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {registrations.by_registration_origin.map((item: RegistrationOrigemItem) => (
                <TableRow key={item.origin}>
                  <TableCell>{formatRegistrationOriginLabel(item.origin)}</TableCell>
                  <TableCell align="right">{item.total}</TableCell>
                  <TableCell align="right">{formatPercent(shareOf(item.total, registrations.total))}</TableCell>
                  <TableCell align="right">{item.with_visit}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="relatorios-origem-coluna">
        <div className="relatorios-faturamento-secao-header">
          <div className="relatorios-faturamento-secao-titulo">
            <h4 className="card-panel-title">Canal de aquisição</h4>
            <p className="card-panel-subtitle">Como o cliente disse que conheceu a barbearia -- declarado, opcional.</p>
          </div>
          {exportCanalButton}
        </div>

        <p className="relatorios-origem-canal-preenchido">
          Canal preenchido em <strong>{formatPercent(registrations.acquisition_channel_filled_share)}</strong> dos
          cadastros do período.
        </p>

        <div className="relatorios-origem-barras" role="list">
          {registrations.by_acquisition_channel.map((item) => {
            const share = shareOf(item.total, registrations.total);
            const destaque = item.channel === NAO_INFORMADO;
            return (
              <div
                role="listitem"
                key={item.channel}
                className={destaque ? 'relatorios-origem-item-destaque' : undefined}
              >
                <PercentageBar
                  label={item.channel}
                  value={`${item.total} · ${formatPercent(share)}`}
                  share={share}
                  trailing={`${item.with_visit} com Visita`}
                />
              </div>
            );
          })}
        </div>

        <div className="relatorios-faturamento-tabela-wrap">
          <Table aria-label="Canal de aquisição">
            <TableHeader>
              <TableRow>
                <TableHead>Canal</TableHead>
                <TableHead align="right">Cadastros</TableHead>
                <TableHead align="right">Participação</TableHead>
                <TableHead align="right">Com Visita</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {registrations.by_acquisition_channel.map((item: AcquisitionChannelItem) => {
                const destaque = item.channel === NAO_INFORMADO;
                return (
                  <TableRow key={item.channel} className={destaque ? 'relatorios-origem-linha-destaque' : undefined}>
                    <TableCell>{item.channel}</TableCell>
                    <TableCell align="right">{item.total}</TableCell>
                    <TableCell align="right">{formatPercent(shareOf(item.total, registrations.total))}</TableCell>
                    <TableCell align="right">{item.with_visit}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <p className="relatorios-origem-orientacao">
          Canal de aquisição é um dado declarado pelo cliente, sem preenchimento automático. Para reduzir "Não
          informado", peça para completar o canal de aquisição na Central 360º do cliente.
        </p>
      </div>

      <style>{`
        .relatorios-origem-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.5rem;
          align-items: start;
        }

        .relatorios-origem-coluna {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          min-width: 0;
        }

        .relatorios-origem-barras {
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
        }

        .relatorios-origem-item-destaque {
          padding: 0.5rem 0.6rem;
          margin: -0.5rem -0.6rem;
          border-radius: var(--radius-md, 8px);
          background: var(--color-brand-lightest, #FFF1E6);
        }

        .relatorios-origem-linha-destaque td {
          background: var(--color-brand-lightest, #FFF1E6);
          font-weight: 700;
        }

        .relatorios-origem-canal-preenchido {
          margin: 0;
          font-size: var(--font-size-sm, 0.875rem);
          color: var(--color-text-secondary, #70625B);
        }

        .relatorios-origem-orientacao {
          margin: 0;
          font-size: var(--font-size-xs, 0.75rem);
          color: var(--color-text-secondary, #70625B);
        }
      `}</style>
    </div>
  );
};
