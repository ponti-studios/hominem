export type CalibrationRow = {
  id: string;
  suite: string;
  label: 'pass' | 'fail';
  verdict: 'pass' | 'fail';
  score: number;
  reason: string;
};

export type CalibrationStats = {
  cases: number;
  humanPass: number;
  humanFail: number;
  judgePass: number;
  judgeFail: number;
  truePass: number;
  trueFail: number;
  falsePass: number;
  falseFail: number;
  agreement: number;
  agreementInterval95: { lower: number; upper: number };
  cohenKappa: number | null;
  interpretation: string;
};

const WILSON_Z_95 = 1.96;

/** Wilson interval for observed agreement, rounded only for persisted/displayed values. */
const wilsonInterval = (successes: number, total: number) => {
  if (total === 0) return { lower: 0, upper: 0 };
  const proportion = successes / total;
  const zSquared = WILSON_Z_95 ** 2;
  const denominator = 1 + zSquared / total;
  const center = (proportion + zSquared / (2 * total)) / denominator;
  const margin =
    (WILSON_Z_95 *
      Math.sqrt((proportion * (1 - proportion)) / total + zSquared / (4 * total ** 2))) /
    denominator;
  return {
    lower: Number(Math.max(0, center - margin).toFixed(4)),
    upper: Number(Math.min(1, center + margin).toFixed(4)),
  };
};

export const summarizeCalibration = (rows: readonly CalibrationRow[]): CalibrationStats => {
  const humanPass = rows.filter((row) => row.label === 'pass').length;
  const humanFail = rows.length - humanPass;
  const judgePass = rows.filter((row) => row.verdict === 'pass').length;
  const judgeFail = rows.length - judgePass;
  const truePass = rows.filter((row) => row.label === 'pass' && row.verdict === 'pass').length;
  const trueFail = rows.filter((row) => row.label === 'fail' && row.verdict === 'fail').length;
  const falsePass = rows.filter((row) => row.label === 'fail' && row.verdict === 'pass').length;
  const falseFail = rows.filter((row) => row.label === 'pass' && row.verdict === 'fail').length;
  const agreement = rows.length === 0 ? 0 : (truePass + trueFail) / rows.length;
  const expectedAgreement =
    rows.length === 0 ? 0 : (humanPass * judgePass + humanFail * judgeFail) / rows.length ** 2;

  return {
    cases: rows.length,
    humanPass,
    humanFail,
    judgePass,
    judgeFail,
    truePass,
    trueFail,
    falsePass,
    falseFail,
    agreement: Number(agreement.toFixed(4)),
    agreementInterval95: wilsonInterval(truePass + trueFail, rows.length),
    cohenKappa:
      rows.length === 0 || expectedAgreement === 1
        ? null
        : Number(((agreement - expectedAgreement) / (1 - expectedAgreement)).toFixed(4)),
    interpretation:
      'Wilson interval assumes independent representative samples; these curated cases are a screening set, not proof of generalization.',
  };
};
