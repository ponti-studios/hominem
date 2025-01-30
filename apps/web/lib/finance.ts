// 2024 Federal Tax Brackets (simplified)
export const federalBrackets = [
	{ min: 0, max: 11600, rate: 0.1 },
	{ min: 11600, max: 47150, rate: 0.12 },
	{ min: 47150, max: 100525, rate: 0.22 },
	{ min: 100525, max: 191950, rate: 0.24 },
	{ min: 191950, max: 243725, rate: 0.32 },
	{ min: 243725, max: 609350, rate: 0.35 },
	{ min: 609350, max: Number.POSITIVE_INFINITY, rate: 0.37 },
];

// State Tax Rates (simplified for example)
export const stateTaxRates = {
	CA: { rate: 0.093, name: "California" },
	NY: { rate: 0.085, name: "New York" },
	TX: { rate: 0, name: "Texas" },
	FL: { rate: 0, name: "Florida" },
	WA: { rate: 0, name: "Washington" },
};
