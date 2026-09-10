import { execFileSync } from 'node:child_process';

import { expect, test as base, type Page } from '@playwright/test';

type Evidence = {
  startedAt: string;
  runLabel: string;
  consoleErrors: string[];
  pageErrors: string[];
  requestFailures: string[];
  expectedRequestFailures: string[];
  apiResponses: Array<{ url: string; status: number; requestId?: string }>;
  chats: Array<{ chatId: string; generationIds: string[] }>;
};

const evidenceByPage = new WeakMap<Page, Evidence>();
const test = base;
const apiUrl = process.env.API_URL ?? 'https://api.lvh.me:4200';
const runId = Date.now().toString(36).toUpperCase();

function revision() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ page }, testInfo) => {
  const evidence: Evidence = {
    startedAt: new Date().toISOString(),
    runLabel: `chat-playbook-${testInfo.project.name}-${Date.now().toString(36)}`,
    consoleErrors: [],
    pageErrors: [],
    requestFailures: [],
    expectedRequestFailures: [],
    apiResponses: [],
    chats: [],
  };
  evidenceByPage.set(page, evidence);
  page.on('console', (message) => {
    if (message.type() === 'error') evidence.consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => evidence.pageErrors.push(error.message));
  page.on('requestfailed', (request) => {
    evidence.requestFailures.push(
      `${request.method()} ${request.url()}: ${request.failure()?.errorText ?? 'unknown'}`,
    );
  });
  page.on('response', (response) => {
    if (!response.url().includes('/api/')) return;
    const requestId = response.headers()['x-request-id'];
    evidence.apiResponses.push({
      url: response.url(),
      status: response.status(),
      ...(requestId ? { requestId } : {}),
    });
  });
});

test.afterEach(async ({ page }, testInfo) => {
  const evidence = evidenceByPage.get(page);
  if (!evidence) return;

  const durable = await Promise.all(
    evidence.chats.flatMap(({ chatId, generationIds }) =>
      generationIds.map(async (generationId) => {
        const [generation, messages] = await Promise.all([
          page.request.get(`${apiUrl}/api/chats/${chatId}/generations/${generationId}`),
          page.request.get(`${apiUrl}/api/chats/${chatId}/messages`),
        ]);
        return {
          chatId,
          generationId,
          generation: generation.ok()
            ? await generation.json()
            : { status: `http-${generation.status()}` },
          messages: messages.ok() ? await messages.json() : { status: `http-${messages.status()}` },
        };
      }),
    ),
  );

  await testInfo.attach('evidence.json', {
    body: JSON.stringify(
      {
        scenarioId: testInfo.title.match(/^[A-Z]+-\d+/)?.[0] ?? testInfo.title,
        title: testInfo.title,
        revision: process.env.GIT_REVISION ?? revision(),
        webUrl: process.env.WEB_URL ?? 'https://web.lvh.me:4200',
        apiUrl: process.env.API_URL ?? 'https://api.lvh.me:4200',
        browser: testInfo.project.use.browserName ?? 'chromium',
        viewport: page.viewportSize(),
        ...evidence,
        durable,
        unverified:
          evidence.consoleErrors.length ||
          evidence.pageErrors.length ||
          evidence.requestFailures.filter(
            (failure) =>
              !evidence.expectedRequestFailures.some((expected) => failure.includes(expected)),
          ).length
            ? 'Unexpected browser/runtime errors were observed.'
            : null,
      },
      null,
      2,
    ),
    contentType: 'application/json',
  });
  try {
    await testInfo.attach('screenshot.png', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
    await testInfo.attach('dom.html', { body: await page.content(), contentType: 'text/html' });
  } catch {
    // Preserve the structured evidence when a failed test has already closed the page.
  }
});

type StartedChat = { chatId: string; generationId: string };

async function startChat(page: Page, message: string): Promise<StartedChat> {
  await page.goto('/chats');
  const createResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/chats',
  );
  await page.getByRole('button', { name: 'Start a new chat' }).click();
  const createResponse = await createResponsePromise;
  expect(createResponse.ok()).toBeTruthy();
  const composer = page.getByRole('textbox', { name: 'Chat message' });
  await composer.fill(message);
  const requestPromise = page.waitForRequest(
    (request) => request.method() === 'POST' && request.url().endsWith('/stream'),
  );
  await page.getByRole('button', { name: 'Submit' }).click();
  const request = await requestPromise;
  const body = JSON.parse(request.postData() ?? '{}') as { generationId?: string };
  if (!body.generationId) throw new Error('Generation request did not include a generation ID');
  const chatId = new URL(page.url()).pathname.split('/').at(-1);
  if (!chatId) throw new Error('Chat URL did not include a chat ID');
  const evidence = evidenceByPage.get(page);
  evidence?.chats.push({ chatId, generationIds: [body.generationId] });
  return { chatId, generationId: body.generationId };
}

async function waitForResponse(page: Page, message: string) {
  const response = page.getByText(message, { exact: true });
  await expect(response).toBeVisible({ timeout: 20_000 });
  await expect(response).toHaveCount(1);
  return response;
}

function apiPath(path: string) {
  return `${apiUrl}/api${path}`;
}

async function expectCommitted(page: Page, chat: StartedChat) {
  const response = await page.request.get(
    apiPath(`/chats/${chat.chatId}/generations/${chat.generationId}`),
  );
  expect(response.ok()).toBeTruthy();
  const run = (await response.json()) as { status?: string };
  expect(run.status).toBe('committed');
}

async function expectGenerationStatus(
  page: Page,
  chatId: string,
  generationId: string,
  status: string,
) {
  const response = await page.request.get(apiPath(`/chats/${chatId}/generations/${generationId}`));
  expect(response.ok()).toBeTruthy();
  const run = (await response.json()) as { status?: string };
  expect(run.status).toBe(status);
}

async function waitForGenerationStatus(
  page: Page,
  chatId: string,
  generationId: string,
  status: string,
) {
  await expect
    .poll(
      async () => {
        const response = await page.request.get(
          apiPath(`/chats/${chatId}/generations/${generationId}`),
        );
        if (!response.ok()) return `http-${response.status()}`;
        const run = (await response.json()) as { status?: string };
        return run.status;
      },
      { timeout: 20_000 },
    )
    .toBe(status);
  await expect(page.getByLabel('Message streaming')).toHaveCount(0);
}

async function expectMessageCount(page: Page, chatId: string, text: string, count: number) {
  const response = await page.request.get(apiPath(`/chats/${chatId}/messages`));
  expect(response.ok()).toBeTruthy();
  const messages = (await response.json()) as Array<{ content?: string }>;
  expect(messages.filter((message) => message.content === text)).toHaveLength(count);
}

function allowExpectedRequestFailure(page: Page, requestUrl: string) {
  evidenceByPage.get(page)?.expectedRequestFailures.push(requestUrl);
}

async function regenerateAndWaitForNewGeneration(page: Page) {
  const requestPromise = page.waitForRequest(
    (request) => request.method() === 'POST' && request.url().endsWith('/regenerate'),
  );
  // Message actions are hidden until the row is hovered or focused
  // (`invisible group-hover:visible` in chat-message-actions.tsx), so the
  // button isn't in the accessibility tree — and therefore isn't findable by
  // getByRole — until the row is actually hovered first.
  await page.locator('[data-chat-message]').last().hover();
  await page.getByRole('button', { name: 'Regenerate response' }).click();
  const request = await requestPromise;
  const body = JSON.parse(request.postData() ?? '{}') as { generationId?: string };
  if (!body.generationId) throw new Error('Regeneration request did not include a generation ID');
  const chatId = new URL(page.url()).pathname.split('/').at(-1);
  const evidence = evidenceByPage.get(page);
  if (chatId && evidence?.chats.at(-1)?.chatId === chatId) {
    evidence.chats.at(-1)?.generationIds.push(body.generationId);
  }
  return body.generationId;
}

async function expectSingleMessage(
  page: Page,
  text: string,
  role: 'user' | 'assistant' = 'assistant',
) {
  const message = page.locator(`.is-${role}[aria-label^="Message"]`).filter({ hasText: text });
  await expect(message).toBeVisible({ timeout: 20_000 });
  await expect(message).toHaveCount(1);
}

test('SEND-01 opens a completed disposable chat directly', async ({ page }) => {
  const chat = await startChat(page, 'SEND-01-DIRECT');
  await waitForResponse(page, 'Scripted response: SEND-01-DIRECT');
  await expectCommitted(page, chat);
  await page.reload();
  await expectSingleMessage(page, 'SEND-01-DIRECT', 'user');
  await expectSingleMessage(page, 'Scripted response: SEND-01-DIRECT');
});

test('SEND-02 sends a normal message and preserves it after refresh', async ({ page }) => {
  const chat = await startChat(page, 'SEND-02-READY');
  await waitForResponse(page, 'Scripted response: SEND-02-READY');
  await expectCommitted(page, chat);
  await expectSingleMessage(page, 'SEND-02-READY', 'user');
  await page.reload();
  await expectSingleMessage(page, 'Scripted response: SEND-02-READY');
});

test('SEND-03 creates a chat through the new-chat entry point', async ({ page }) => {
  const chat = await startChat(page, 'SEND-03-NEW-CHAT');
  await waitForResponse(page, 'Scripted response: SEND-03-NEW-CHAT');
  await page.goto('/chats');
  await expect(page.getByRole('link', { name: /SEND-03-NEW-CHAT/ }).first()).toBeVisible();
  expect(chat.chatId).toMatch(/^[0-9a-f-]{36}$/);
});

test('SEND-04 navigates list, detail, back, and detail without stale history', async ({ page }) => {
  const chat = await startChat(page, 'SEND-04-NAVIGATION');
  await waitForResponse(page, 'Scripted response: SEND-04-NAVIGATION');
  await page.goto('/chats');
  await page
    .getByRole('link', { name: /SEND-04-NAVIGATION/ })
    .first()
    .click();
  await expect(page).toHaveURL(new RegExp(`/chat/${chat.chatId}$`));
  await expectSingleMessage(page, 'SEND-04-NAVIGATION', 'user');
  await page.goBack();
  await page
    .getByRole('link', { name: /SEND-04-NAVIGATION/ })
    .first()
    .click();
  await expectSingleMessage(page, 'Scripted response: SEND-04-NAVIGATION');
});

test('SEND-05 regenerates the latest assistant response once', async ({ page }) => {
  const chat = await startChat(page, 'SEND-05-REGENERATE');
  await waitForResponse(page, 'Scripted response: SEND-05-REGENERATE');
  const regeneratedGenerationId = await regenerateAndWaitForNewGeneration(page);
  await waitForGenerationStatus(page, chat.chatId, regeneratedGenerationId, 'committed');
  await waitForResponse(page, 'Scripted response: SEND-05-REGENERATE');
  await expectSingleMessage(page, 'SEND-05-REGENERATE', 'user');
  await expectSingleMessage(page, 'Scripted response: SEND-05-REGENERATE');
  // Regenerating deletes the superseded run (see RECOVER-01), so
  // chat.generationId (the pre-regeneration run) is gone — only the
  // regenerated id is still expected to resolve.
  await expectGenerationStatus(page, chat.chatId, regeneratedGenerationId, 'committed');
});

test('TOOL-01 completes a successful tool call', async ({ page }) => {
  const chat = await startChat(page, 'List my collections SCRIPT:TOOL_READY');
  await expect(page.getByLabel('Completed')).toBeVisible({ timeout: 20_000 });
  await waitForResponse(page, 'SCRIPT:TOOL_READY');
  await expectCommitted(page, chat);
});

test('TOOL-02 approves a confirmation-required tool', async ({ page }) => {
  const chat = await startChat(page, 'Create a private collection named TOOL-02 approval check.');
  await expect(page.getByRole('button', { name: 'Approve tool action' })).toBeVisible({
    timeout: 20_000,
  });
  await page.getByRole('button', { name: 'Approve tool action' }).click();
  await waitForResponse(page, 'The collection was created successfully.');
  await expectCommitted(page, chat);
});

test('TOOL-03 rejects a confirmation-required tool without success state', async ({ page }) => {
  const chat = await startChat(page, 'Create a private collection named TOOL-03 rejection check.');
  await expect(page.getByRole('button', { name: 'Reject tool action' })).toBeVisible({
    timeout: 20_000,
  });
  await page.getByRole('button', { name: 'Reject tool action' }).click();
  await waitForResponse(page, 'The tool request was rejected.');
  await expect(page.getByLabel('Denied')).toBeVisible();
  await expect(page.getByLabel('Completed')).toHaveCount(0);
  await expectCommitted(page, chat);
});

test('TOOL-04 retains a failed tool card and exposes recovery', async ({ page }) => {
  const chat = await startChat(page, 'List my collections SCRIPT:TOOL_FAIL');
  await expect(page.getByLabel('Error')).toBeVisible({ timeout: 20_000 });
  await waitForResponse(page, 'The tool request failed.');
  // Message actions are hidden until the row is hovered or focused
  // (`invisible group-hover:visible` in chat-message-actions.tsx), so a
  // hover is required before getByRole can find them at all.
  await page.locator('[data-chat-message]').last().hover();
  await expect(page.getByRole('button', { name: 'Regenerate response' })).toBeVisible();
  await expectCommitted(page, chat);
});

test('RECOVER-01 shows friendly provider recovery and retries without a duplicate user message', async ({
  page,
}) => {
  const message = `Provider failure RECOVER-01 SCRIPT:PROVIDER_FAIL-${runId}`;
  const assistantResponse = `Scripted response: ${message}`;
  const chat = await startChat(page, message);
  await expect(page.getByText('I couldn’t finish that response. Please try again.')).toBeVisible({
    timeout: 20_000,
  });
  await expectSingleMessage(page, message, 'user');
  await page.reload();
  await expect(page.getByText('I couldn’t finish that response. Please try again.')).toBeVisible();
  const retryRequestPromise = page.waitForRequest(
    (request) => request.method() === 'POST' && request.url().endsWith('/regenerate'),
  );
  await page.getByRole('button', { name: 'Retry' }).click();
  const retryRequest = await retryRequestPromise;
  const retryBody = JSON.parse(retryRequest.postData() ?? '{}') as { generationId?: string };
  if (!retryBody.generationId) throw new Error('Retry request did not include a generation ID');
  evidenceByPage.get(page)?.chats.at(-1)?.generationIds.push(retryBody.generationId);
  await expect(page.getByText('Trying again…')).toBeVisible();
  await waitForGenerationStatus(page, chat.chatId, retryBody.generationId, 'committed');
  await waitForResponse(page, assistantResponse);
  await expectSingleMessage(page, message, 'user');
  // The retried attempt supersedes the failed one outright — its run is
  // deleted once the retry commits, same as regenerating a completed reply.
  const deletedResponse = await page.request.get(
    apiPath(`/chats/${chat.chatId}/generations/${chat.generationId}`),
  );
  expect(deletedResponse.status()).toBe(404);
  await expectGenerationStatus(page, chat.chatId, retryBody.generationId, 'committed');
  await expectMessageCount(page, chat.chatId, message, 1);
});

test('RECOVER-02 cancels before provider execution', async ({ page }) => {
  await startChat(page, 'SCRIPT:CANCEL_BEFORE');
  await expect(page.getByRole('button', { name: 'Stop' })).toBeVisible();
  await page.getByRole('button', { name: 'Stop' }).click();
  await expect(page.getByText('Stopped.')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('Scripted response: SCRIPT:CANCEL_BEFORE')).toHaveCount(0);
});

test('RECOVER-03 cancels while streaming without false success', async ({ page }) => {
  await startChat(page, 'SCRIPT:STREAM');
  await expect(page.getByRole('button', { name: 'Stop' })).toBeVisible();
  await page.getByRole('button', { name: 'Stop' }).click();
  await expect(page.getByText('Stopped.')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('Scripted response: SCRIPT:STREAM')).toHaveCount(0);
});

test('RECOVER-04 recovers after active-generation reload', async ({ page }) => {
  await startChat(page, 'SCRIPT:DISCONNECT');
  await page.waitForTimeout(250);
  await page.reload();
  await waitForResponse(page, 'Scripted response: SCRIPT:DISCONNECT');
});

test('RECOVER-05 keeps overlapping replay state single after reload', async ({ page }) => {
  await startChat(page, 'SCRIPT:REPLAY');
  await page.waitForTimeout(250);
  await page.reload();
  await waitForResponse(page, 'Scripted response: SCRIPT:REPLAY');
  await page.reload();
  await expectSingleMessage(page, 'Scripted response: SCRIPT:REPLAY');
});

test('RECOVER-06 keeps confirmation actionable after reload', async ({ page }) => {
  await startChat(page, 'Create a private collection named RECOVER-06 reload confirmation check.');
  await expect(page.getByRole('button', { name: 'Approve tool action' })).toBeVisible({
    timeout: 20_000,
  });
  await page.reload();
  await expect(page.getByRole('button', { name: 'Approve tool action' })).toBeVisible();
});

test('LAUNCH-01 reconstructs a completed chat in a fresh page', async ({ page }) => {
  const chat = await startChat(page, 'LAUNCH-01-FRESH-LAUNCH');
  await waitForResponse(page, 'Scripted response: LAUNCH-01-FRESH-LAUNCH');
  const freshPage = await page.context().newPage();
  await freshPage.goto(`/chat/${chat.chatId}`);
  await expect(freshPage.getByText('Scripted response: LAUNCH-01-FRESH-LAUNCH')).toBeVisible();
  await freshPage.close();
});

test('LAUNCH-02 recovers an active generation after reload', async ({ page }) => {
  await startChat(page, 'SCRIPT:ACTIVE_RELOAD');
  await page.waitForTimeout(250);
  await page.reload();
  await waitForResponse(page, 'Scripted response: SCRIPT:ACTIVE_RELOAD');
});

test('LAUNCH-03 does not render an unowned chat', async ({ page }) => {
  await page.goto('/chat/00000000-0000-4000-8000-000000000018');
  await expect(page.getByText('Conversation unavailable')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('textbox', { name: 'Chat message' })).toHaveCount(0);
});

test('LAUNCH-04 denies an unowned chat operation without changing durable state', async ({
  page,
}) => {
  await page.goto('/chat/00000000-0000-4000-8000-000000000019');
  await expect(page.getByText('Conversation unavailable')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('button', { name: 'Regenerate response' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Delete user message' })).toHaveCount(0);
});

test('UI-01 shows a recoverable load error', async ({ page }, testInfo) => {
  const chat = await startChat(page, 'UI-01-LOAD-ERROR');
  await page.goto('/chats');
  let intercepted = false;
  await page.route(`**/api/chats/${chat.chatId}/messages*`, (route) => {
    if (new URL(route.request().url()).searchParams.get('limit') === '1') {
      return route.continue();
    }
    intercepted = true;
    allowExpectedRequestFailure(page, route.request().url());
    return route.abort();
  });
  await page.locator(`a[href="/chat/${chat.chatId}"]`).click();
  if (!intercepted) {
    testInfo.skip(
      true,
      'Blocked: chat loader fetches messages server-side, outside browser interception.',
    );
  }
  await expect(page.getByRole('alert')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('button', { name: 'Retry loading' })).toBeVisible();
});

test('UI-02 shows a centered load error with recovery', async ({ page }, testInfo) => {
  const chat = await startChat(page, 'UI-02-LOAD-ERROR');
  await page.goto('/chats');
  let intercepted = false;
  await page.route(`**/api/chats/${chat.chatId}/messages*`, (route) => {
    if (new URL(route.request().url()).searchParams.get('limit') === '1') {
      return route.continue();
    }
    intercepted = true;
    return route.fulfill({ status: 500, body: JSON.stringify({ error: 'test load failure' }) });
  });
  await page.locator(`a[href="/chat/${chat.chatId}"]`).click();
  if (!intercepted) {
    testInfo.skip(
      true,
      'Blocked: chat loader fetches messages server-side, outside browser interception.',
    );
  }
  await expect(page.getByRole('alert')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('button', { name: 'Retry loading' })).toBeVisible();
});

test('UI-03 edits and deletes a disposable user message', async ({ page }) => {
  await startChat(page, 'UI-03-EDIT-ME');
  await waitForResponse(page, 'Scripted response: UI-03-EDIT-ME');
  // Message actions are hidden until the row is hovered or focused
  // (`invisible group-hover:visible` in chat-message-actions.tsx), so a
  // hover is required before getByRole can find them at all.
  const userMessage = page.locator('[data-chat-message]').first();
  await userMessage.hover();
  await page.getByRole('button', { name: 'Edit message' }).click();
  const editor = page.getByRole('textbox', { name: 'Edit message' });
  await editor.fill('UI-03-EDITED');
  await page.getByRole('button', { name: 'Save edit' }).click();
  await expectSingleMessage(page, 'UI-03-EDITED', 'user');
  await userMessage.hover();
  await page.getByRole('button', { name: 'Delete user message' }).click();
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await page.getByRole('button', { name: 'Delete message' }).click();
  await expect(page.getByText('UI-03-EDITED')).toHaveCount(0);
});

test('UI-04 exercises copy, share, listen, and regenerate controls', async ({ page }) => {
  const chat = await startChat(page, 'UI-04-ACTIONS');
  await waitForResponse(page, 'Scripted response: UI-04-ACTIONS');
  // Message actions are hidden until the row is hovered or focused
  // (`invisible group-hover:visible` in chat-message-actions.tsx), so a
  // hover is required before getByRole can find them at all.
  await page.locator('[data-chat-message]').first().hover();
  await page.getByRole('button', { name: 'Copy user message' }).click();
  await expect(page.getByRole('button', { name: 'Copied user message' })).toBeVisible();
  await page.locator('[data-chat-message]').last().hover();
  await expect(page.getByRole('button', { name: 'Copy assistant message' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Share assistant message' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Listen to response' })).toBeVisible();
  const regeneratedGenerationId = await regenerateAndWaitForNewGeneration(page);
  await waitForGenerationStatus(page, chat.chatId, regeneratedGenerationId, 'committed');
  await waitForResponse(page, 'Scripted response: UI-04-ACTIONS');
  // Regenerating deletes the superseded run (see RECOVER-01), so
  // chat.generationId (the pre-regeneration run) is gone — only the
  // regenerated id is still expected to resolve.
  await expectGenerationStatus(page, chat.chatId, regeneratedGenerationId, 'committed');
});

test('UI-05 keeps the chat usable at the smallest supported viewport', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await startChat(page, 'UI-05-VIEWPORT');
  await waitForResponse(page, 'Scripted response: UI-05-VIEWPORT');
  await expect(page.getByRole('textbox', { name: 'Chat message' })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBeFalsy();
});

test('UI-06 exposes keyboard-reachable named chat controls', async ({ page }) => {
  await startChat(page, 'UI-06-ACCESSIBILITY');
  await waitForResponse(page, 'Scripted response: UI-06-ACCESSIBILITY');
  const userMessage = page.locator('[data-chat-message]').first();
  const assistantMessage = page.locator('[data-chat-message]').last();
  for (const name of ['Copy user message', 'Copy assistant message', 'Regenerate response']) {
    // Message actions are hidden until the row is hovered or focused
    // (`invisible group-hover:visible` in chat-message-actions.tsx), so a
    // hover is required before getByRole can find them at all.
    await (name === 'Copy user message' ? userMessage : assistantMessage).hover();
    const control = page.getByRole('button', { name });
    await expect(control).toBeVisible();
    await control.focus();
    await expect(control).toBeFocused();
  }
  const composer = page.getByRole('textbox', { name: 'Chat message' });
  await composer.focus();
  await composer.fill('UI-06-KEYBOARD');
  await composer.press('ControlOrMeta+Enter');
  await waitForResponse(page, 'Scripted response: UI-06-KEYBOARD');
  await expectSingleMessage(page, 'UI-06-ACCESSIBILITY', 'user');
  await expectSingleMessage(page, 'UI-06-KEYBOARD', 'user');
});

test('UI-07 preserves an unsent composer draft across reload, and only the draft', async ({
  page,
}) => {
  await startChat(page, 'UI-07-DRAFT-SEED');
  await waitForResponse(page, 'Scripted response: UI-07-DRAFT-SEED');
  const composer = page.getByRole('textbox', { name: 'Chat message' });
  await composer.fill('UI-07-UNSENT-DRAFT');
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Chat message' })).toHaveValue(
    'UI-07-UNSENT-DRAFT',
  );
  await expectSingleMessage(page, 'UI-07-DRAFT-SEED', 'user');
  await expectSingleMessage(page, 'Scripted response: UI-07-DRAFT-SEED');
  // Regression guard: the persisted-draft `useState` initializer used to read
  // localStorage synchronously on first client render, diffing against the
  // empty SSR output and producing a React hydration-mismatch console error.
  const evidence = evidenceByPage.get(page);
  expect(evidence?.consoleErrors ?? []).toEqual([]);

  await page.getByRole('textbox', { name: 'Chat message' }).fill('');
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Chat message' })).toHaveValue('');
});

test('UI-08 sends and reads a message under prefers-reduced-motion without errors', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await startChat(page, 'UI-08-REDUCED-MOTION');
  await waitForResponse(page, 'Scripted response: UI-08-REDUCED-MOTION');
  await expectSingleMessage(page, 'UI-08-REDUCED-MOTION', 'user');
  await expectSingleMessage(page, 'Scripted response: UI-08-REDUCED-MOTION');
  const evidence = evidenceByPage.get(page);
  expect(evidence?.consoleErrors ?? []).toEqual([]);
});

test('UI-09 keeps the composer interactive immediately after send, before the reply arrives', async ({
  page,
}) => {
  await startChat(page, 'UI-09-NO-BLOCK');
  const composer = page.getByRole('textbox', { name: 'Chat message' });
  await expect(composer).toHaveValue('');
  await composer.fill('typed while the reply is still generating');
  await expect(composer).toHaveValue('typed while the reply is still generating');
  await waitForResponse(page, 'Scripted response: UI-09-NO-BLOCK');
});
