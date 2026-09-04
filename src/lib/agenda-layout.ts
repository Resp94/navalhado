export interface AgendaLayoutItem {
  id: string;
  startMs: number;
  endMs: number;
  isFitting?: boolean;
}

export interface AgendaHorizontalLayout {
  left: string;
  width: string;
  lane: number;
  laneCount: number;
}

const formatPercentage = (value: number) =>
  value.toFixed(3).replace(/\.?(0+)$/, '');

export function calculateAgendaHorizontalLayout(
  items: readonly AgendaLayoutItem[],
): Map<string, AgendaHorizontalLayout> {
  const sortedItems = [...items].sort((a, b) =>
    a.startMs - b.startMs || Number(Boolean(a.isFitting)) - Number(Boolean(b.isFitting)),
  );
  const result = new Map<string, AgendaHorizontalLayout>();

  for (let index = 0; index < sortedItems.length;) {
    const group: AgendaLayoutItem[] = [];
    let groupEnd = sortedItems[index].endMs;

    while (index < sortedItems.length && (group.length === 0 || sortedItems[index].startMs < groupEnd)) {
      const current = sortedItems[index];
      group.push(current);
      groupEnd = Math.max(groupEnd, current.endMs);
      index += 1;
    }

    const laneEnds: number[] = [];
    const lanes = new Map<string, number>();

    for (const current of group) {
      let lane = laneEnds.findIndex((laneEnd) => laneEnd <= current.startMs);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(current.endMs);
      } else {
        laneEnds[lane] = current.endMs;
      }
      lanes.set(current.id, lane);
    }

    const laneCount = laneEnds.length;
    const laneWidth = 100 / laneCount;

    for (const current of group) {
      const lane = lanes.get(current.id)!;
      const percentage = formatPercentage(laneWidth);
      const offset = formatPercentage(lane * laneWidth);
      result.set(current.id, {
        left: lane === 0 ? '4px' : `calc(${offset}% + 4px)`,
        width: `calc(${percentage}% - 8px)`,
        lane,
        laneCount,
      });
    }
  }

  return result;
}
