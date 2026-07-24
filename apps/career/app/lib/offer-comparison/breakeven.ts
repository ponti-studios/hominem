export interface BreakevenResult {
  annualGap: number;
  bonusPctToClose: number;
  equityToClose: number;
  monthsToRecoupMove: number;
}

export function computeBreakeven(
  annualNetA: number,
  annualNetB: number,
  movingCost: number,
  grossSalaryB: number,
): BreakevenResult {
  const annualGap = annualNetB - annualNetA;
  const monthlyDelta = annualGap / 12;

  const bonusPctToClose = annualGap > 0 && grossSalaryB > 0 ? (annualGap / grossSalaryB) * 100 : 0;

  const equityToClose = Math.max(0, annualGap);

  const monthsToRecoupMove = monthlyDelta > 0 ? Math.ceil(movingCost / monthlyDelta) : Infinity;

  return {
    annualGap: Math.round(annualGap),
    bonusPctToClose: Math.round(bonusPctToClose * 10) / 10,
    equityToClose: Math.round(equityToClose),
    monthsToRecoupMove,
  };
}
