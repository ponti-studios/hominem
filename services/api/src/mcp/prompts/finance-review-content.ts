export function buildFinanceReviewPromptText(month?: string): string {
  return [
    month
      ? `Review my finances for ${month}.`
      : 'Ask me which calendar month to review before calling any finance tools.',
    'For the selected month, call finance_monthly_stats with month set to YYYY-MM, finance_spending_by_category with the first and last calendar dates as from and to, and finance_top_merchants with the same from and to dates.',
    'Give a concise report headed with the selected YYYY-MM month, followed by income, expenses, net, transaction count, largest spending categories and top merchants. Use only values returned by the tools.',
    'Keep currencies separate. Never add amounts in different currencies or present a combined total. If a result has a null currencyCode, do not assign its amounts to a currency; for top merchants, report names without amounts when currencyCode is null. If a metric is null or a tool returns warnings, explain the limitation and preserve the tool warning.',
    'This workflow is read-only. Do not create, update, delete, import, or otherwise change finance data.',
  ].join('\n');
}
