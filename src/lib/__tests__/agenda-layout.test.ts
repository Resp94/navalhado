import { describe, expect, it } from 'vitest';
import { calculateAgendaHorizontalLayout } from '../agenda-layout';

const item = (id: string, startMs: number, endMs: number, isFitting = false) => ({
  id,
  startMs,
  endMs,
  isFitting,
});

describe('calculateAgendaHorizontalLayout', () => {
  it('usa toda a coluna para um card solo', () => {
    const layout = calculateAgendaHorizontalLayout([
      item('solo', 0, 30),
    ]).get('solo');

    expect(layout).toEqual({
      left: '4px',
      width: 'calc(100% - 8px)',
      lane: 0,
      laneCount: 1,
    });
  });

  it('divide cards concorrentes em duas faixas percentuais', () => {
    const layout = calculateAgendaHorizontalLayout([
      item('regular', 0, 30),
      item('fitting', 0, 30, true),
    ]);

    expect(layout.get('regular')).toEqual({
      left: '4px',
      width: 'calc(50% - 8px)',
      lane: 0,
      laneCount: 2,
    });
    expect(layout.get('fitting')).toEqual({
      left: 'calc(50% + 4px)',
      width: 'calc(50% - 8px)',
      lane: 1,
      laneCount: 2,
    });
  });

  it('mantém o card normal à esquerda quando regular e encaixe começam juntos', () => {
    const layout = calculateAgendaHorizontalLayout([
      item('fitting', 0, 30, true),
      item('regular', 0, 30),
    ]);

    expect(layout.get('regular')?.lane).toBe(0);
    expect(layout.get('fitting')?.lane).toBe(1);
  });

  it('cria três faixas quando três intervalos concorrem', () => {
    const layout = calculateAgendaHorizontalLayout([
      item('a', 0, 30),
      item('b', 0, 30),
      item('c', 0, 30),
    ]);

    expect([...layout.values()].map(({ lane, laneCount }) => [lane, laneCount])).toEqual([
      [0, 3],
      [1, 3],
      [2, 3],
    ]);
    expect(layout.get('c')?.left).toBe('calc(66.667% + 4px)');
    expect(layout.get('c')?.width).toBe('calc(33.333% - 8px)');
  });

  it('não considera intervalos apenas encostados como sobreposição', () => {
    const layout = calculateAgendaHorizontalLayout([
      item('first', 0, 30),
      item('second', 30, 60),
    ]);

    expect(layout.get('first')?.laneCount).toBe(1);
    expect(layout.get('second')?.laneCount).toBe(1);
  });
});
