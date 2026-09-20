import React, { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { HugeiconsIcon } from '@hugeicons/react';
import { Calendar03Icon, Coins01Icon, Money01Icon } from '@hugeicons/core-free-icons';
import { useToast } from '../../components/Toast';
import type { BarbeiroContextType } from '../../components/BarbeiroLayout';
import { ExtratoContaProfissionalModal } from '../../components/financeiro/ExtratoContaProfissionalModal';
import { formatCurrency } from '../../lib/currency';
import { ComissaoRepository } from '../../modules/comissoes/ComissaoRepository';
import { SupabaseComissaoAdapter } from '../../modules/comissoes/adapters/SupabaseComissaoAdapter';
import { intervaloDeComissao } from '../../modules/comissoes/periodo';
import type { PeriodoComissao } from '../../modules/comissoes/periodo';
import type { ItemComissaoGerada, SaldoComissaoProfissional } from '../../modules/comissoes/types';
import { ContaProfissionalRepository } from '../../modules/contaProfissional/ContaProfissionalRepository';
import type { ProfessionalAccountEntry } from '../../modules/contaProfissional/types';
import { SupabaseContaProfissionalAdapter } from '../../modules/contaProfissional/adapters/SupabaseContaProfissionalAdapter';

const comissaoRepository = new ComissaoRepository(new SupabaseComissaoAdapter());
const contaProfissionalRepository = new ContaProfissionalRepository(new SupabaseContaProfissionalAdapter());

const PERIODOS: Array<{ id: PeriodoComissao; label: string }> = [
  { id: 'today', label: 'Hoje' },
  { id: '7days', label: '7 Dias' },
  { id: 'month', label: 'Mês' },
];

const CARD_CLASS = 'bg-bg-secondary border border-border rounded-lg shadow-sm p-4 flex flex-col gap-1 min-w-0';

/**
 * Comissões do barbeiro. Todo valor vem do que foi gravado no fechamento da Comanda, pelas mesmas
 * consultas da Quitação de Comissão do gestor: mudar a porcentagem do catálogo não altera o que já foi
 * fechado. O banco recusa qualquer profissional que não seja o dele.
 */
export const MinhasComissoes: React.FC = () => {
  const { tenantId, timezone, professionalId, professionalName } = useOutletContext<BarbeiroContextType>();
  const { addToast } = useToast();

  const [period, setPeriod] = useState<PeriodoComissao>('month');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [balance, setBalance] = useState<SaldoComissaoProfissional | null>(null);
  const [items, setItems] = useState<ItemComissaoGerada[]>([]);
  // Vales em aberto (spec 034): o profissional vê os próprios, não os dos colegas.
  const [openAdvances, setOpenAdvances] = useState<ProfessionalAccountEntry[]>([]);
  const [showExtrato, setShowExtrato] = useState(false);

  useEffect(() => {
    if (!professionalId) {
      setLoading(false);
      return;
    }
    let isMounted = true;

    const load = async () => {
      setLoading(true);
      setErrorMsg(null);
      const { startIso, endIso } = intervaloDeComissao(period, new Date(), timezone);
      const query = { professional_id: professionalId, start_date: startIso, end_date: endIso, tenant_id: tenantId };

      try {
        const [saldo, itens] = await Promise.all([
          comissaoRepository.obterSaldoProfissional(query),
          comissaoRepository.obterItensComissaoProfissional(query),
        ]);
        if (!isMounted) return;
        setBalance(saldo);
        setItems(itens);
      } catch (err: unknown) {
        console.error('Erro ao consultar comissões do barbeiro:', err);
        if (!isMounted) return;
        setBalance(null);
        setItems([]);
        // O banco recusa com uma frase própria (extrato de outro profissional, cadastro inativo...).
        const reason = err instanceof Error && err.message ? err.message : 'Erro ao carregar dados de comissão.';
        setErrorMsg(reason);
        addToast(reason, 'error');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    void load();
    return () => {
      isMounted = false;
    };
  }, [professionalId, tenantId, timezone, period, addToast]);

  useEffect(() => {
    if (!professionalId || !tenantId) return;
    let isMounted = true;

    contaProfissionalRepository
      .listEntries(professionalId, tenantId)
      .then((entries) => {
        if (isMounted) setOpenAdvances(entries.filter((e) => e.entry_type === 'vale' && e.status !== 'reversed'));
      })
      .catch(() => {
        if (isMounted) setOpenAdvances([]);
      });

    return () => {
      isMounted = false;
    };
  }, [professionalId, tenantId]);

  const totalRevenue = useMemo(() => items.reduce((sum, item) => sum + item.net_amount, 0), [items]);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: timezone,
    });

  if (!professionalId) {
    return (
      <div className="max-w-[420px] w-full mx-auto flex flex-col items-center text-center gap-3 py-10 px-6 bg-bg-secondary rounded-lg shadow-lg border border-border">
        <h3 className="text-base font-bold text-text-primary m-0">Acesso não vinculado</h3>
        <p className="text-text-secondary text-sm leading-normal m-0">
          Nenhum cadastro de profissional vinculado a esta conta de usuário. Entre em contato com o gerente.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-[960px] w-full mx-auto flex flex-col gap-4">
      <section
        className="flex items-center gap-2.5 w-max max-w-full py-2 pr-4 pl-5 rounded-full bg-bg-secondary border border-border shadow-sm text-text-secondary text-xs font-medium mx-auto max-md:w-full max-md:justify-center max-md:flex-wrap max-md:gap-2 max-md:px-3"
        aria-label="Período"
      >
        <HugeiconsIcon icon={Calendar03Icon} size={16} />
        <span className="font-semibold text-xs tracking-[0.02em]">Período</span>
        <div className="w-px h-4 bg-border" />
        <div className="flex gap-1">
          {PERIODOS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriod(p.id)}
              aria-pressed={period === p.id}
              className={`border-none py-[0.3rem] px-3 rounded-full text-xs font-semibold cursor-pointer transition-all duration-200 ${
                period === p.id
                  ? 'text-brand-lightest bg-brand-primary shadow-[0_2px_8px_rgba(217,108,0,0.2)]'
                  : 'bg-transparent text-text-secondary hover:text-text-primary hover:bg-black/[0.04]'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </section>

      {loading ? (
        <div className="flex flex-col gap-4" aria-busy="true">
          <div className="grid grid-cols-3 gap-3 max-md:grid-cols-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-[96px] rounded-lg bg-[linear-gradient(90deg,var(--color-bg-secondary)_25%,var(--color-border)_37%,var(--color-bg-secondary)_63%)] bg-[length:400%_100%] animate-shimmer"
              />
            ))}
          </div>
          <div className="h-[220px] rounded-lg bg-[linear-gradient(90deg,var(--color-bg-secondary)_25%,var(--color-border)_37%,var(--color-bg-secondary)_63%)] bg-[length:400%_100%] animate-shimmer" />
        </div>
      ) : errorMsg ? (
        <div role="alert" className="bg-error-bg text-error border border-error/30 rounded-lg p-4 text-sm">
          <strong className="block mb-1">Não foi possível abrir suas comissões</strong>
          {errorMsg}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3 max-md:grid-cols-1">
            <div className={CARD_CLASS}>
              <div className="flex items-center justify-between text-text-secondary">
                <span className="text-[10px] font-bold uppercase tracking-[0.15em]">Comissão do período</span>
                <HugeiconsIcon icon={Coins01Icon} size={18} className="text-brand-primary" />
              </div>
              <span className="text-[1.75rem] font-extrabold leading-none tracking-[-0.03em] text-brand-primary">
                {formatCurrency(balance?.generated_commission ?? 0)}
              </span>
              <p className="text-xs text-text-secondary m-0">Valor gravado no fechamento das Comandas.</p>
            </div>

            <div className={CARD_CLASS}>
              <div className="flex items-center justify-between text-text-secondary">
                <span className="text-[10px] font-bold uppercase tracking-[0.15em]">Receita gerada</span>
                <HugeiconsIcon icon={Money01Icon} size={18} className="text-info" />
              </div>
              <span className="text-[1.75rem] font-extrabold leading-none tracking-[-0.03em] text-text-primary">
                {formatCurrency(totalRevenue)}
              </span>
              <p className="text-xs text-text-secondary m-0">Valor dos itens que geraram comissão no período.</p>
            </div>

            <div className={CARD_CLASS}>
              <div className="flex items-center justify-between text-text-secondary">
                <span className="text-[10px] font-bold uppercase tracking-[0.15em]">A receber</span>
                <HugeiconsIcon icon={Coins01Icon} size={18} className="text-success" />
              </div>
              <span className="text-[1.75rem] font-extrabold leading-none tracking-[-0.03em] text-text-primary">
                {formatCurrency(balance?.suggested_net_amount ?? 0)}
              </span>
              <p className="text-xs text-text-secondary m-0">Comissões e gorjetas em aberto, menos vales.</p>
            </div>
          </div>

          <section className="bg-bg-secondary border border-border rounded-lg shadow-sm p-4 max-md:p-3">
            <div className="mb-3 flex flex-col gap-0.5">
              <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-text-secondary opacity-60">Extrato</span>
              <h2 className="text-lg font-bold text-text-primary m-0">Atendimentos com comissão</h2>
            </div>

            {items.length === 0 ? (
              <div className="text-center py-10 px-6 text-text-secondary text-sm">
                <p className="m-0">Nenhum atendimento com comissão registrada neste período.</p>
              </div>
            ) : (
              <>
                <table className="w-full border-collapse text-left max-md:hidden">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-[0.08em] text-text-secondary">
                      <th className="py-2 px-3 font-semibold border-b border-border">Data</th>
                      <th className="py-2 px-3 font-semibold border-b border-border">Cliente</th>
                      <th className="py-2 px-3 font-semibold border-b border-border">Item</th>
                      <th className="py-2 px-3 font-semibold border-b border-border text-right">Valor</th>
                      <th className="py-2 px-3 font-semibold border-b border-border text-right">%</th>
                      <th className="py-2 px-3 font-semibold border-b border-border text-right">Comissão</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.item_id ?? `${item.comanda_id}-${item.accrued_at}`} className="[&_td]:py-3 [&_td]:px-3 [&_td]:text-sm [&_td]:border-b [&_td]:border-border/50">
                        <td className="whitespace-nowrap text-xs text-text-secondary">{formatDate(item.accrued_at)}</td>
                        <td className="font-semibold">{item.customer_name || 'Cliente Balcão'}</td>
                        <td>{item.item_name}</td>
                        <td className="text-right whitespace-nowrap">{formatCurrency(item.net_amount)}</td>
                        <td className="text-right whitespace-nowrap">
                          {item.commission_percentage == null ? '—' : `${Math.round(item.commission_percentage)}%`}
                        </td>
                        <td className="text-right whitespace-nowrap font-bold text-brand-primary">
                          {formatCurrency(item.commission_amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <ul className="hidden flex-col gap-3 m-0 p-0 list-none max-md:flex">
                  {items.map((item) => (
                    <li
                      key={item.item_id ?? `${item.comanda_id}-${item.accrued_at}`}
                      className="border border-border rounded-lg overflow-hidden"
                    >
                      <div className="flex justify-between items-center py-2.5 px-3 bg-black/[0.02] border-b border-border">
                        <span className="text-xs text-text-secondary font-medium">{formatDate(item.accrued_at)}</span>
                        <span className="text-xs font-semibold text-brand-primary">{item.item_name}</span>
                      </div>
                      <div className="py-2.5 px-3 flex flex-col gap-1.5 text-sm text-text-secondary">
                        <div className="flex justify-between">
                          <span>Cliente</span>
                          <span className="font-semibold text-text-primary">{item.customer_name || 'Cliente Balcão'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Valor</span>
                          <span className="font-semibold text-text-primary">{formatCurrency(item.net_amount)}</span>
                        </div>
                        <div className="flex justify-between pt-1.5 border-t border-border/60">
                          <span className="font-semibold text-text-primary">
                            Sua comissão
                            {item.commission_percentage != null && (
                              <span className="text-text-secondary font-medium text-xs"> ({Math.round(item.commission_percentage)}%)</span>
                            )}
                          </span>
                          <span className="text-brand-primary font-extrabold text-base">{formatCurrency(item.commission_amount)}</span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          {openAdvances.length > 0 && (
            <section className="bg-bg-secondary border border-border rounded-lg shadow-sm py-4 px-5" aria-labelledby="advances-section-title">
              <div className="mb-3">
                <span id="advances-section-title" className="text-[0.8rem] uppercase tracking-[0.04em] font-bold text-text-secondary">Vales em aberto</span>
                <p className="text-[0.8rem] text-text-secondary mt-0.5 mb-0">Adiantamentos registrados pela gestão, ainda não quitados.</p>
              </div>
              <ul className="list-none m-0 p-0 flex flex-col gap-2">
                {openAdvances.map((entry) => (
                  <li key={entry.id} className="flex items-baseline justify-between gap-3 py-1.5 border-b border-dashed border-border">
                    <span className="font-extrabold [font-variant-numeric:tabular-nums] text-brand-primary">{formatCurrency(entry.amount)}</span>
                    <span className="text-[0.8rem] text-text-secondary text-right">{entry.reason}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <button
        type="button"
        onClick={() => setShowExtrato(true)}
        className="w-full bg-bg-secondary border border-dashed border-border rounded-lg py-[0.85rem] px-5 text-[0.85rem] font-bold text-brand-primary cursor-pointer transition-all duration-200 ease-in hover:bg-bg-primary hover:border-brand-primary"
      >
        Ver extrato completo da conta (vales, gorjetas e quitações)
      </button>

      <ExtratoContaProfissionalModal
        isOpen={showExtrato}
        professional={{ id: professionalId, name: professionalName }}
        tenantId={tenantId}
        onClose={() => setShowExtrato(false)}
      />
    </div>
  );
};
