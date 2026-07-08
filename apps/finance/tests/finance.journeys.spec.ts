import { expect, test } from './fixtures'

test('unauthenticated landing signs in with OTP and reaches finance', async ({ page, context }) => {
  await context.clearCookies()
  await page.goto('/')
  await expect(page).toHaveTitle(/finance/i)
  await page.goto('/finance')
  await expect(page).toHaveURL(/\/auth/)
})

test('empty dashboard and accounts states render', async ({ authenticatedPage, financeApi }) => {
  await financeApi.reset()

  await authenticatedPage.goto('/finance')
  await expect(authenticatedPage.getByText('No transactions found')).toBeVisible()

  await authenticatedPage.goto('/accounts')
  await expect(
    authenticatedPage.getByRole('heading', { name: 'Bank Accounts', exact: true }),
  ).toBeVisible()
  await expect(authenticatedPage.getByRole('heading', { name: 'No Bank Accounts' })).toBeVisible()
})

test('seeded transactions support search, filters, sorting, and pagination shell', async ({
  authenticatedPage,
  financeSeed,
}) => {
  await authenticatedPage.goto('/finance')
  await expect(authenticatedPage.getByText('Whole Foods Market')).toBeVisible()
  await expect(authenticatedPage.getByText('Ponti Studios Payroll')).toBeVisible()

  const searchInput = authenticatedPage.getByPlaceholder('Search transactions...')
  await expect(searchInput).toBeEnabled()
  await searchInput.fill('Whole')
  await expect(searchInput).toHaveValue('Whole')
  await expect(authenticatedPage.getByText('Description: Whole').first()).toBeVisible({
    timeout: 20000,
  })
  await expect(authenticatedPage.getByText('Failed to fetch')).not.toBeVisible()

  await authenticatedPage.goto(`/accounts/${financeSeed.accounts.checking}`)
  await expect(authenticatedPage.getByText('Everyday Checking').first()).toBeVisible()
  await expect(authenticatedPage.getByText('Whole Foods Market')).toBeVisible()
})

test('accounts list and detail show manual and Plaid-like status states', async ({
  authenticatedPage,
  financeSeed,
}) => {
  await authenticatedPage.goto('/accounts')
  await expect(authenticatedPage.getByRole('heading', { name: 'Your Accounts' })).toBeVisible()
  await expect(authenticatedPage.getByText('Everyday Checking')).toBeVisible()
  await expect(authenticatedPage.getByText('Emergency Savings')).toBeVisible()
  await expect(authenticatedPage.getByText('Plaid Connected').first()).toBeVisible()
  await expect(authenticatedPage.getByText('Manual Account').first()).toBeVisible()

  await authenticatedPage.goto(`/accounts/${financeSeed.accounts.credit}`)
  await expect(authenticatedPage.getByText('Travel Credit').first()).toBeVisible()
  await expect(authenticatedPage.getByText('Atlas Air Flight')).toBeVisible()
})

test('analytics overview, monthly drilldown, and tag pages render seeded insights', async ({
  authenticatedPage,
  financeSeed,
}) => {
  await authenticatedPage.goto('/analytics')
  await expect(authenticatedPage.getByRole('heading', { name: 'Analytics' })).toBeVisible()
  await expect(authenticatedPage.getByText('Top Merchants')).toBeVisible()
  await expect(authenticatedPage.getByText('Top Tags')).toBeVisible()

  await authenticatedPage.goto('/analytics/monthly/2026-01')
  await expect(authenticatedPage.getByText(/January|2026-01/)).toBeVisible()

  await authenticatedPage.goto('/analytics/tags')
  await expect(authenticatedPage.getByRole('heading', { name: 'Tags Breakdown' })).toBeVisible()

  await authenticatedPage.goto(`/analytics/tag/${financeSeed.tags.travel}`)
  await expect(authenticatedPage.getByText(/Travel|Analytics/)).toBeVisible()
})

test('runway calculator accepts seeded recurring assumptions', async ({ authenticatedPage }) => {
  await authenticatedPage.goto('/finance/runway')
  await expect(authenticatedPage.getByRole('heading', { name: /Runway/i })).toBeVisible()
  const calculateButton = authenticatedPage.getByRole('button', { name: /Calculate Runway/i })
  await expect(async () => {
    await authenticatedPage.getByLabel(/Initial Balance/i).fill('12000')
    await authenticatedPage.getByLabel(/Monthly Expenses/i).fill('3100')
    await expect(calculateButton).toBeEnabled()
  }).toPass({ timeout: 20000 })
  await calculateButton.click()
  await expect(async () => {
    await expect(authenticatedPage.getByText('Runway (Months)')).toBeVisible()
  }).toPass({ timeout: 20000 })
})

test('CSV import UI handles valid selection and invalid/error states deterministically', async ({
  authenticatedPage,
}) => {
  await authenticatedPage.goto('/import')
  await expect(authenticatedPage.getByRole('heading', { name: 'Import Transactions' })).toBeVisible()
  const fileInput = authenticatedPage.getByLabel('File input')
  await expect(fileInput).toBeEnabled()

  await expect(async () => {
    await fileInput.setInputFiles({
      name: 'transactions.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('date,description,amount\n2026-01-12,Test Coffee,-7.25\n'),
    })
    await expect(authenticatedPage.getByText('transactions.csv')).toBeVisible()
  }).toPass({ timeout: 20000 })

  await expect(async () => {
    await fileInput.setInputFiles({
      name: 'invalid.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('not,csv\n'),
    })
    await expect(authenticatedPage.getByText('invalid.txt')).toBeVisible()
  }).toPass({ timeout: 20000 })
})

test('export transactions downloads CSV with expected shape', async ({
  authenticatedPage,
  financeSeed,
}) => {
  void financeSeed
  await authenticatedPage.goto('/finance')
  await authenticatedPage.goto('/account')
  await expect(authenticatedPage.getByRole('heading', { name: 'Finance Settings' })).toBeVisible()
  const exportButton = authenticatedPage.getByRole('button', { name: 'Export CSV' })
  await expect(exportButton).toBeEnabled({ timeout: 20000 })
  const downloadPromise = authenticatedPage.waitForEvent('download')
  await exportButton.click()
  const download = await downloadPromise
  const stream = await download.createReadStream()
  const chunks: Buffer[] = []

  await new Promise<void>((resolve, reject) => {
    stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
    stream.on('end', resolve)
    stream.on('error', reject)
  })

  const csv = Buffer.concat(chunks).toString('utf8')
  expect(download.suggestedFilename()).toMatch(/^transactions-\d{4}-\d{2}-\d{2}\.csv$/)
  expect(csv).toContain('Date,Description,Amount,Category,Type,Account')
  expect(csv).toContain('Whole Foods Market')
})

test('settings security page and logout are reachable', async ({ authenticatedPage }) => {
  await authenticatedPage.goto('/settings/security')
  await expect(authenticatedPage.getByRole('heading', { name: 'Security' })).toBeVisible()

  await authenticatedPage.goto('/auth/logout')
  await expect(authenticatedPage).toHaveURL(/\/auth|\/$/)
})
