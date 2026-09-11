(function () {
  //#region src/routes/login/ai-footprint.ts
  const AI_FOOTPRINT_ESTIMATES = {
    electricityKwhPerRequest: 34e-5,
    waterLitersPerRequest: 0.01,
  };
  function estimateAIFootprint(requestCount) {
    return {
      electricityKwh: requestCount * AI_FOOTPRINT_ESTIMATES.electricityKwhPerRequest,
      waterLiters: requestCount * AI_FOOTPRINT_ESTIMATES.waterLitersPerRequest,
    };
  }
  //#endregion
  //#region src/routes/login/settings-ai-footprint.ts
  const numberFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
  function formatWater(liters) {
    return liters < 1 ? `${Math.round(liters * 1e3)} mL` : `${numberFormatter.format(liters)} L`;
  }
  function formatElectricity(kilowattHours) {
    return kilowattHours < 1
      ? `${Math.round(kilowattHours * 1e3)} Wh`
      : `${kilowattHours.toFixed(2)} kWh`;
  }
  async function load() {
    const response = await fetch('/api/usage/ai', { headers: { accept: 'application/json' } });
    if (!response.ok) return;
    const requestCount = (await response.json()).summary.requestCount;
    const footprint = estimateAIFootprint(requestCount);
    const water = document.querySelector('[data-footprint-water]');
    const electricity = document.querySelector('[data-footprint-electricity]');
    const waterFormula = document.querySelector('[data-footprint-water-formula]');
    const electricityFormula = document.querySelector('[data-footprint-electricity-formula]');
    const requests = document.querySelector('[data-footprint-requests]');
    if (water) water.textContent = formatWater(footprint.waterLiters);
    if (electricity) electricity.textContent = formatElectricity(footprint.electricityKwh);
    if (waterFormula)
      waterFormula.textContent = `${requestCount} requests × ${AI_FOOTPRINT_ESTIMATES.waterLitersPerRequest * 1e3} mL`;
    if (electricityFormula)
      electricityFormula.textContent = `${requestCount} requests × ${AI_FOOTPRINT_ESTIMATES.electricityKwhPerRequest * 1e3} Wh`;
    if (requests)
      requests.textContent = `Based on ${requestCount.toLocaleString()} AI request${requestCount === 1 ? '' : 's'} this month.`;
  }
  load();
  //#endregion
})();
