// Client-side enhancement for the hosted /auth/settings page: loads the
// monthly AI usage report and saves the account name through the API's
// same-origin /auth/settings/profile endpoint. Vite serves this module during
// development and emits its hashed production asset. Everything the page needs
// to work degraded (plain form submit for sign-out, server-rendered name/email)
// survives without this module.

const usdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});
const usagePeriodFormatter = new Intl.DateTimeFormat('en-US', {
  month: '2-digit',
  year: '2-digit',
});

function formatUsd(amount: number): string {
  return usdFormatter.format(amount);
}

function formatUsagePeriod(): string {
  const parts = usagePeriodFormatter.formatToParts(new Date());
  const month = parts.find((part) => part.type === 'month')?.value ?? '';
  const year = parts.find((part) => part.type === 'year')?.value ?? '';
  return `${month} '${year}`;
}

type MonthlyUsageStatus = {
  isOverLimit: boolean;
  limitUsd: number;
  totalCostUsd: number;
};

async function loadUsage(): Promise<void> {
  const section = document.querySelector<HTMLElement>('[data-settings-usage]');
  if (!section) return;

  try {
    const response = await fetch('/api/usage/monthly', { headers: { accept: 'application/json' } });
    if (!response.ok) {
      section.hidden = true;
      return;
    }
    const usage: MonthlyUsageStatus = await response.json();
    const label = section.querySelector<HTMLElement>('[data-settings-usage-label]');
    const amount = section.querySelector<HTMLElement>('[data-settings-usage-amount]');
    const limit = section.querySelector<HTMLElement>('[data-settings-usage-limit]');
    const bar = section.querySelector<HTMLElement>('[data-settings-usage-bar]');
    const reset = section.querySelector<HTMLElement>('[data-settings-usage-reset]');
    const percent = Math.min(100, (usage.totalCostUsd / usage.limitUsd) * 100);

    if (label) label.textContent = `AI usage · ${formatUsagePeriod()}`;
    if (amount) amount.textContent = formatUsd(usage.totalCostUsd);
    if (limit) limit.textContent = `of ${formatUsd(usage.limitUsd)} · ${percent.toFixed(0)}%`;
    if (bar) bar.style.width = `${percent}%`;
    if (reset && usage.isOverLimit) {
      reset.textContent =
        "You've reached this month's free AI usage limit. It resets at the start of next month.";
      reset.dataset.overLimit = '';
    } else if (reset) {
      reset.textContent = 'Resets at the start of next month.';
    }
  } catch {
    section.hidden = true;
  }
}

const nameInput = document.querySelector<HTMLInputElement>('[data-settings-name]');
const saveButton = document.querySelector<HTMLButtonElement>('[data-settings-save]');
const saveStatus = document.querySelector<HTMLElement>('[data-settings-save-status]');
if (nameInput && saveButton && saveStatus) {
  const initialName = nameInput.value.trim();
  let saving = false;

  const syncSaveButton = () => {
    const changed = nameInput.value.trim() !== initialName;
    saveButton.hidden = !changed;
    if (!changed) saveStatus.hidden = true;
  };

  nameInput.addEventListener('input', () => {
    saveStatus.hidden = true;
    syncSaveButton();
  });

  saveButton.addEventListener('click', async () => {
    const name = nameInput.value.trim();
    if (!name) {
      saveStatus.textContent = 'Name cannot be empty.';
      saveStatus.dataset.error = '';
      saveStatus.hidden = false;
      return;
    }
    if (saving) return;
    saving = true;
    saveButton.disabled = true;
    saveButton.textContent = 'Saving';
    saveStatus.hidden = true;
    try {
      const response = await fetch('/auth/settings/profile', {
        method: 'POST',
        body: new URLSearchParams({ name }),
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
      });
      if (!response.ok) {
        const body: { error?: string } | null = await response.json().catch(() => null);
        throw new Error(body?.error ?? 'Could not save name.');
      }
      nameInput.value = name;
      syncSaveButton();
      saveStatus.textContent = 'Saved';
      delete saveStatus.dataset.error;
      saveStatus.hidden = false;
    } catch (error) {
      saveStatus.textContent = error instanceof Error ? error.message : 'Could not save name.';
      saveStatus.dataset.error = '';
      saveStatus.hidden = false;
    } finally {
      saving = false;
      saveButton.disabled = false;
      saveButton.textContent = 'Save';
    }
  });
}

void loadUsage();
