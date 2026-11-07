import { computeFederalTax, computeFICA, type FilingStatus } from './federal';
import { computeStateTax } from './state';
import { computeUKIncomeTax, computeUKNationalInsurance } from './uk';

export interface TaxResult {
  incomeTax: number;
  payrollTax: number;
  totalTax: number;
  netAnnual: number;
  netMonthly: number;
  effectiveRate: number;
}

export function computeUSTax(gross: number, stateSlug: string, status: FilingStatus): TaxResult {
  const federalTax = computeFederalTax(gross, status);
  const stateTax = computeStateTax(stateSlug, gross, status);
  const fica = computeFICA(gross);

  const totalTax = federalTax + stateTax + fica;
  const netAnnual = gross - totalTax;

  return {
    incomeTax: federalTax + stateTax,
    payrollTax: fica,
    totalTax,
    netAnnual,
    netMonthly: netAnnual / 12,
    effectiveRate: (totalTax / gross) * 100,
  };
}

export function computeUKTax(gross: number): TaxResult {
  const incomeTax = computeUKIncomeTax(gross);
  const ni = computeUKNationalInsurance(gross);

  const totalTax = incomeTax + ni;
  const netAnnual = gross - totalTax;

  return {
    incomeTax,
    payrollTax: ni,
    totalTax,
    netAnnual,
    netMonthly: netAnnual / 12,
    effectiveRate: (totalTax / gross) * 100,
  };
}
