import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test, type APIRequestContext, type Browser, type Page } from '@playwright/test';

const webUrl = process.env.WEB_URL ?? 'https://web.lvh.me';
const apiUrl = process.env.API_URL ?? 'https://api.lvh.me';
const runId = Date.now().toString(36);
const tag = `E2E ${runId}`;
const slug = `e2e-career-${runId}`;
const authPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../.auth/web-user.json',
);

let api: APIRequestContext;

// The dev server hydrates after the document loads; wait for the module graph
// to settle before driving a form, otherwise a click can run against the
// server-rendered markup before React Router attaches.
async function go(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ playwright }) => {
  api = await playwright.request.newContext({
    baseURL: apiUrl,
    storageState: authPath,
    ignoreHTTPSErrors: true,
  });

  const profile = await api.patch('/api/career/profile', {
    data: {
      firstName: 'E2E',
      lastName: 'Career',
      headline: 'Browser test',
      slug,
      isPublic: true,
    },
  });
  expect(profile.ok()).toBeTruthy();
});

test.afterAll(async () => {
  if (!api) return;

  const [engagements, projects, skills, testimonials, applications] = await Promise.all([
    api.get('/api/career/engagements'),
    api.get('/api/career/projects'),
    api.get('/api/career/skills'),
    api.get('/api/career/testimonials'),
    api.get('/api/career/applications'),
  ]);

  if (engagements.ok()) {
    for (const item of (await engagements.json()).engagements ?? []) {
      if (String(item.company).includes(tag)) {
        await api.post('/api/career/engagements/delete', { data: { id: item.id } });
      }
    }
  }
  if (projects.ok()) {
    for (const item of (await projects.json()).projects ?? []) {
      if (String(item.title).includes(tag)) {
        await api.post('/api/career/projects/delete', { data: { id: item.id } });
      }
    }
  }
  if (skills.ok()) {
    for (const item of (await skills.json()).skills ?? []) {
      if (String(item.name).includes(tag)) {
        await api.post('/api/career/skills/delete', { data: { id: item.id } });
      }
    }
  }
  if (testimonials.ok()) {
    for (const item of (await testimonials.json()).testimonials ?? []) {
      if (String(item.name).includes(tag)) {
        await api.post('/api/career/testimonials/delete', { data: { id: item.id } });
      }
    }
  }
  if (applications.ok()) {
    for (const item of (await applications.json()).applications ?? []) {
      if (String(item.company).includes(tag)) {
        await api.post('/api/career/applications/delete', { data: { id: item.id } });
      }
    }
  }

  await api.dispose();
});

test('platform header links to both sub-apps', async ({ page }) => {
  await go(page, '/career');
  await expect(page.getByRole('link', { name: 'Career', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Finance', exact: true })).toBeVisible();
});

test('career home renders the work and project summaries', async ({ page }) => {
  await go(page, '/career');
  await expect(page.getByRole('heading', { name: 'Work history' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible();
});

test('creates a work engagement and opens its detail page', async ({ page }) => {
  await go(page, '/career/work/new');
  await page.getByLabel('Company *').fill(`${tag} Analytics`);
  await page.getByLabel('Title *').fill('Staff Engineer');
  await page.getByRole('button', { name: 'Create engagement' }).click();

  await expect(page).toHaveURL(/\/career\/work\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { name: 'Staff Engineer' })).toBeVisible();
  await expect(page.getByText(`${tag} Analytics`)).toBeVisible();
});

test('creates a project and lists it', async ({ page }) => {
  await go(page, '/career/projects/new');
  await page.getByLabel('Title').fill(`${tag} Engine`);
  await page.getByRole('button', { name: 'Add project' }).click();

  await expect(page).toHaveURL(/\/career\/projects$/);
  await expect(page.getByText(`${tag} Engine`)).toBeVisible();
});

test('adds a skill through the dialog', async ({ page }) => {
  await go(page, '/career/skills');
  await page.getByRole('button', { name: 'Add skill' }).first().click();
  const dialog = page.getByRole('dialog');
  const nameField = dialog.getByLabel('Name');
  await nameField.fill(`${tag} TypeScript`);
  // The dialog stays mounted after the action, so pressing Enter in the field
  // submits without racing a re-render on the button.
  await nameField.press('Enter');

  await expect(page.getByText(`${tag} TypeScript`)).toBeVisible({ timeout: 10_000 });
});

test('adds a testimonial', async ({ page }) => {
  await go(page, '/career/testimonials/new');
  await page.getByLabel('Name').fill(`${tag} Reference`);
  await page.locator('textarea[name="content"]').fill('Worked closely on the platform migration.');
  await page.getByRole('button', { name: 'Add testimonial' }).last().click();

  await expect(page).toHaveURL(/\/career\/testimonials$/);
  await expect(page.getByText(`${tag} Reference`)).toBeVisible();
});

test('creates an application and renders every detail tab', async ({ page }) => {
  await go(page, '/career/applications/new');
  await page.getByLabel(/Job Title/).fill('Platform Engineer');
  await page.getByLabel(/Company/).fill(`${tag} Corp`);
  await page.getByRole('button', { name: 'Create Application' }).click();

  await expect(page).toHaveURL(/\/career\/applications\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { name: /Platform Engineer/ })).toBeVisible();

  for (const tab of ['Timeline', 'Notes', 'Files', 'Resume']) {
    await page.getByRole('link', { name: tab, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/${tab.toLowerCase()}$`));
  }
});

test('profile renders the editable profile surface', async ({ page }) => {
  await go(page, '/career/profile');
  await expect(page.getByRole('heading', { name: /Profile/ })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Profile URL' })).toHaveValue(slug);
  await expect(page.getByRole('textbox', { name: 'Full Name' })).toHaveValue('E2E Career');
});

test('onboarding renders the resume import form', async ({ page }) => {
  await go(page, '/career/onboarding');
  await expect(
    page.getByRole('heading', { name: 'Fill your profile from a resume' }),
  ).toBeVisible();
});

test('editing profile basics persists through the API', async ({ page }) => {
  await go(page, '/career/profile');

  // The basics form requires tagline, bio, and location, and react-hook-form
  // marks fields dirty from typed input events, so drive it like a person.
  const type = async (label: string, value: string) => {
    const field = page.getByRole('textbox', { name: label });
    await field.click();
    await field.press('Meta+A');
    await field.press('Backspace');
    await field.pressSequentially(value, { delay: 10 });
  };

  await type('Job Title', 'Principal Engineer');
  await type('Tagline', 'Builds platforms');
  await type('Bio', 'Browser test bio for the platform migration.');
  await type('Location', 'London');

  await page.getByRole('button', { name: 'Save changes' }).click();
  await page.waitForTimeout(1500);

  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Job Title' })).toHaveValue('Principal Engineer');
});

test('the public portfolio renders logged out', async ({
  page,
  browser,
}: {
  page: import('@playwright/test').Page;
  browser: Browser;
}) => {
  await expect(page).toBeDefined();

  const anonymous = await browser.newContext({ baseURL: webUrl, ignoreHTTPSErrors: true });
  const publicPage = await anonymous.newPage();
  try {
    await publicPage.goto(`/p/${slug}`);
    await expect(publicPage.getByRole('heading', { name: 'E2E Career' })).toBeVisible();
  } finally {
    await anonymous.close();
  }
});

test('career navigation stays within a performance budget', async ({ page }) => {
  await go(page, '/career');
  await page.waitForLoadState('networkidle');
  const duration = await page.evaluate(
    () => performance.getEntriesByType('navigation')[0]?.duration ?? 0,
  );

  test
    .info()
    .annotations.push({ type: 'navigation-ms', description: String(Math.round(duration)) });
  expect(duration).toBeLessThan(4000);
});

test('the public portfolio API responds within budget', async ({ request }) => {
  const durations: number[] = [];
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const started = Date.now();
    const response = await request.get(`${apiUrl}/api/career/portfolio/${slug}`);
    durations.push(Date.now() - started);
    expect(response.ok()).toBeTruthy();
  }

  const warm = durations.slice(1);
  const average = Math.round(warm.reduce((total, value) => total + value, 0) / warm.length);
  const slowest = Math.max(...warm);

  test.info().annotations.push({ type: 'portfolio-api-average-ms', description: String(average) });
  test.info().annotations.push({ type: 'portfolio-api-slowest-ms', description: String(slowest) });
  expect(slowest).toBeLessThan(1500);
});
