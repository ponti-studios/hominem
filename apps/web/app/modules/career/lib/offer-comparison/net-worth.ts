export interface NetWorthPoint {
  year: number;
  value: number;
}

export function projectNetWorth(
  startingNetWorth: number,
  monthlyDelta: number,
  months: number,
): NetWorthPoint[] {
  const points: NetWorthPoint[] = [{ year: 0, value: startingNetWorth }];
  let current = startingNetWorth;
  let year = 0;
  for (let m = 1; m <= months; m++) {
    current += monthlyDelta;
    if (m % 12 === 0) {
      year = m / 12;
      points.push({ year, value: Math.round(current) });
    }
  }
  return points;
}
