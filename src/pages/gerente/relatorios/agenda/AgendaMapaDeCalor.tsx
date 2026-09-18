import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../../components/ui/feedback/Card';
import { EmptyState } from '../../../../components/ui/data-display/EmptyState';
import type { RelatorioAgendaHeatmap } from '../../../../modules/relatorios/types';

/**
 * Rótulo abreviado de cada dia da semana, na convenção do núcleo do banco
 * (`extract(dow)`): índice `0` = domingo até `6` = sábado -- nunca a
 * convenção ISO (segunda = 1). Ver "Mapa de Calor da Agenda" no CONTEXT.md.
 */
export const WEEKDAY_LABELS_ABBR = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const WEEKDAY_LABELS_FULL = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

/** Uma linha densa do mapa (uma hora, contagem para cada um dos 7 dias). */
export interface AgendaMapaDeCalorLinha {
  hour: number;
  counts: number[];
}

/**
 * Cruza `heatmap.hours` (já ordenado) com os 7 dias da semana para montar a
 * grade completa: o núcleo do banco só devolve `cells` com pelo menos 1
 * Agendamento -- uma combinação ausente vale `0` (responsabilidade da tela,
 * documentada no `comment on function` da migração do ticket 08). Usada
 * tanto pela grade visual quanto pela tabela equivalente/CSV, para as duas
 * nunca divergirem.
 */
export function construirLinhasMapaDeCalor(heatmap: RelatorioAgendaHeatmap): AgendaMapaDeCalorLinha[] {
  const contagemPorCelula = new Map<string, number>();
  heatmap.cells.forEach((cell) => {
    contagemPorCelula.set(`${cell.weekday}-${cell.hour}`, cell.count);
  });

  return heatmap.hours.map((hour) => ({
    hour,
    counts: WEEKDAY_LABELS_ABBR.map((_, weekday) => contagemPorCelula.get(`${weekday}-${hour}`) ?? 0),
  }));
}

function formatarHora(hour: number): string {
  return `${hour}h`;
}

export interface AgendaMapaDeCalorProps {
  heatmap: RelatorioAgendaHeatmap | null;
  /** Botão "Exportar CSV" desta seção, injetado pela página. */
  exportButton?: React.ReactNode;
}

/**
 * Mapa de calor por dia da semana e hora da Agenda (spec 038, ticket 08,
 * histórias 50-55): grade CSS grid com a contagem de Agendamento não
 * cancelado (falta conta) por dia x hora, colorida pela intensidade
 * relativa ao maior valor da própria grade. Segue o mesmo filtro de
 * profissional das demais seções da página (`AgendaResumo`,
 * `AgendaPorOrigem`, `AgendaMotivosCancelamento`): o `heatmap` já chega
 * filtrado por `p_professional_id` dentro de `data` -- este componente não
 * recebe `professionalId`/`onProfessionalIdChange` nem repete o `<Select>`,
 * que mora só em `AgendaPorProfissional` (a única tabela que o filtro NÃO
 * atinge).
 *
 * Cada célula mostra o número exato como texto (não só em tooltip/`title`),
 * com `aria-label` explícito por célula -- a spec pede que a leitura não
 * dependa só da cor. A tabela HTML abaixo é a fonte real dos MESMOS dados
 * (nunca duplicados/divergentes: as duas usam `construirLinhasMapaDeCalor`)
 * e é o que o botão "Exportar CSV" desta seção exporta; fica visualmente
 * oculta (`sr-only`, utilitário global já existente em `src/index.css`)
 * porque a grade colorida com número dentro de cada célula já é, sozinha,
 * uma leitura completa e acessível -- sem precedente de "tabela oculta" em
 * outra seção do módulo, decisão deste ticket.
 */
export const AgendaMapaDeCalor: React.FC<AgendaMapaDeCalorProps> = ({ heatmap, exportButton }) => {
  const hours = heatmap?.hours ?? [];
  const linhas = heatmap ? construirLinhasMapaDeCalor(heatmap) : [];
  const maxCount = heatmap ? Math.max(0, ...heatmap.cells.map((cell) => cell.count)) : 0;

  function intensidade(count: number): number {
    if (maxCount <= 0 || count <= 0) return 0;
    return count / maxCount;
  }

  return (
    <Card variant="outline">
      <CardHeader>
        <div className="flex items-center justify-between gap-4 mb-3">
          <div className="flex flex-col gap-1">
            <CardTitle>Mapa de calor por dia e horário</CardTitle>
            <CardDescription>
              Demanda (não ocupação) por dia da semana e hora, no fuso da unidade -- cancelado não conta, falta
              conta.
            </CardDescription>
          </div>
          {exportButton}
        </div>
      </CardHeader>
      <CardContent>
        {hours.length === 0 ? (
          <EmptyState
            title="Sem horas para mostrar"
            description="Não há Agendamento nem expediente configurado no período e no filtro de profissional selecionados."
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <div
                className="grid gap-[2px] min-w-[34rem]"
                style={{ gridTemplateColumns: `4rem repeat(7, minmax(3.25rem, 1fr))` }}
                role="presentation"
              >
                <div className="text-xs font-bold text-center px-1 py-[0.35rem] text-text-secondary" />
                {WEEKDAY_LABELS_ABBR.map((label) => (
                  <div
                    key={label}
                    className="text-xs font-bold text-center px-1 py-[0.35rem] text-text-secondary"
                  >
                    {label}
                  </div>
                ))}

                {linhas.map((linha) => (
                  <React.Fragment key={linha.hour}>
                    <div className="text-xs font-semibold flex items-center justify-end pr-2 text-text-secondary [font-variant-numeric:tabular-nums]">
                      {formatarHora(linha.hour)}
                    </div>
                    {linha.counts.map((count, weekday) => {
                      const alpha = intensidade(count);
                      const label = `${WEEKDAY_LABELS_FULL[weekday]}, ${formatarHora(linha.hour)}: ${count} agendamento${count === 1 ? '' : 's'}`;
                      return (
                        <div
                          key={weekday}
                          className="flex items-center justify-center min-h-[2.25rem] rounded-sm bg-[var(--color-surface-muted,#F3EFEC)] text-xs font-semibold [font-variant-numeric:tabular-nums] text-text-primary"
                          style={
                            alpha > 0
                              ? {
                                  backgroundColor: `color-mix(in srgb, var(--color-brand-primary, #D96C00) ${Math.round(
                                    10 + alpha * 80
                                  )}%, var(--color-surface-muted, #F3EFEC))`,
                                }
                              : undefined
                          }
                          title={label}
                          aria-label={label}
                        >
                          {count}
                        </div>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* `sr-only` na `<div>`, nunca na `<table>`: alguns engines ignoram
                width/height/overflow de clip em elementos de tabela, então o
                layout real (7 colunas) vaza da caixa de 1px e infla a altura
                do documento -- foi a causa raiz do sidebar sticky soltando no
                fim da página. */}
            <div className="sr-only">
              <table aria-label="Mapa de calor por dia e horário (tabela equivalente)">
                <thead>
                  <tr>
                    <th>Hora</th>
                    {WEEKDAY_LABELS_FULL.map((label) => (
                      <th key={label}>{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((linha) => (
                    <tr key={linha.hour}>
                      <th scope="row">{formatarHora(linha.hour)}</th>
                      {linha.counts.map((count, weekday) => (
                        <td key={weekday}>{count}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
