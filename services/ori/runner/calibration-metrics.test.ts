import { expect, test } from 'vitest';

import { summarizeCalibration, type CalibrationRow } from './calibration-metrics';

const row = (id: string, label: 'pass' | 'fail', verdict: 'pass' | 'fail'): CalibrationRow => ({
  id,
  suite: 'voice-cleanup',
  label,
  verdict,
  score: verdict === 'pass' ? 1 : 0,
  reason: '',
});

test('summarizes agreement, confusion counts, kappa, and uncertainty', () => {
  const stats = summarizeCalibration([
    row('pass-match', 'pass', 'pass'),
    row('fail-match', 'fail', 'fail'),
    row('false-pass', 'fail', 'pass'),
    row('false-fail', 'pass', 'fail'),
  ]);

  expect(stats).toMatchObject({
    cases: 4,
    humanPass: 2,
    humanFail: 2,
    judgePass: 2,
    judgeFail: 2,
    truePass: 1,
    trueFail: 1,
    falsePass: 1,
    falseFail: 1,
    agreement: 0.5,
    cohenKappa: 0,
  });
  expect(stats.agreementInterval95.lower).toBeLessThan(stats.agreement);
  expect(stats.agreementInterval95.upper).toBeGreaterThan(stats.agreement);
});

test('does not report a defined kappa for an empty or constant-label sample', () => {
  expect(summarizeCalibration([]).cohenKappa).toBeNull();
  expect(
    summarizeCalibration([row('pass-1', 'pass', 'pass'), row('pass-2', 'pass', 'pass')]).cohenKappa,
  ).toBeNull();
});
