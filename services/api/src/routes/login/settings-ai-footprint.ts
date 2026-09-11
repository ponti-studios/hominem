import { AI_FOOTPRINT_ESTIMATES, estimateAIFootprint } from './ai-footprint';

type UsagePagePayload = {
  summary: { requestCount: number };
};

const numberFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });

function formatWater(liters: number): string {
  return liters < 1 ? `${Math.round(liters * 1_000)} mL` : `${numberFormatter.format(liters)} L`;
}

function formatElectricity(kilowattHours: number): string {
  return kilowattHours < 1
    ? `${Math.round(kilowattHours * 1_000)} Wh`
    : `${kilowattHours.toFixed(2)} kWh`;
}

async function load(): Promise<void> {
  const response = await fetch('/api/usage/ai', { headers: { accept: 'application/json' } });
  if (!response.ok) return;

  const data = (await response.json()) as UsagePagePayload;
  const requestCount = data.summary.requestCount;
  const footprint = estimateAIFootprint(requestCount);
  const water = document.querySelector<HTMLElement>('[data-footprint-water]');
  const electricity = document.querySelector<HTMLElement>('[data-footprint-electricity]');
  const waterFormula = document.querySelector<HTMLElement>('[data-footprint-water-formula]');
  const electricityFormula = document.querySelector<HTMLElement>(
    '[data-footprint-electricity-formula]',
  );
  const requests = document.querySelector<HTMLElement>('[data-footprint-requests]');

  if (water) water.textContent = formatWater(footprint.waterLiters);
  if (electricity) electricity.textContent = formatElectricity(footprint.electricityKwh);
  if (waterFormula)
    waterFormula.textContent = `${requestCount} requests × ${AI_FOOTPRINT_ESTIMATES.waterLitersPerRequest * 1_000} mL`;
  if (electricityFormula)
    electricityFormula.textContent = `${requestCount} requests × ${AI_FOOTPRINT_ESTIMATES.electricityKwhPerRequest * 1_000} Wh`;
  if (requests)
    requests.textContent = `Based on ${requestCount.toLocaleString()} AI request${requestCount === 1 ? '' : 's'} this month.`;
}

void load();
