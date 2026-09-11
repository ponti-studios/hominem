import { PageFrame } from './page-frame';
import { pageFrame, settingsPage } from './styles.generated';

type SettingsUser = {
  id: string;
  name: string | null;
  email: string | null;
};

function getInitials(name: string, fallback: string): string {
  const source = name.trim() || fallback;
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function SettingsPage({ user, loginNextUrl }: { user: SettingsUser; loginNextUrl: string }) {
  const name = user.name ?? '';
  const email = user.email ?? '';
  const initials = getInitials(name, email);

  return (
    <PageFrame script="/settings.js" title="Settings | Hominem">
      <div class={pageFrame.authContent}>
        <div class={pageFrame.authHeading}>
          <h2 id="settings-title">Account</h2>
          <p class={pageFrame.cardCopy}>Manage your Hominem account.</p>
        </div>

        <section class={settingsPage.section}>
          <p class={settingsPage.sectionLabel}>Account</p>
          <div class={settingsPage.identityRow}>
            <span aria-hidden="true" class={settingsPage.avatar}>
              {initials}
            </span>
            <input
              aria-label="Name"
              class={settingsPage.nameInput}
              data-settings-name
              placeholder="Your name"
              spellCheck={false}
              type="text"
              value={name}
            />
          </div>
          <p class={settingsPage.email}>{email || 'Not available'}</p>
          <div class={settingsPage.saveRow}>
            <button class={settingsPage.saveButton} data-settings-save hidden type="button">
              Save
            </button>
            <p class={settingsPage.saveStatus} data-settings-save-status hidden />
          </div>
        </section>

        <section class={settingsPage.section} data-settings-usage>
          <p class={settingsPage.sectionLabel} data-settings-usage-label>
            AI usage
          </p>
          <div class={settingsPage.usageSummary}>
            <p class={settingsPage.usageAmount} data-settings-usage-amount>
              $0.00
            </p>
            <p class={settingsPage.usageLimit} data-settings-usage-limit>
              &nbsp;
            </p>
          </div>
          <div aria-hidden="true" class={settingsPage.usageBar}>
            <div class={settingsPage.usageBarFill} data-settings-usage-bar style="width: 0%" />
          </div>
          <p class={settingsPage.usageReset} data-settings-usage-reset />
        </section>

        <section class={settingsPage.section}>
          <form action="/logout" method="post">
            <input name="next" type="hidden" value={loginNextUrl} />
            <button class={settingsPage.dangerButton} data-settings-signout type="submit">
              Sign out
            </button>
          </form>
          <div class={settingsPage.confirm} data-settings-confirm hidden>
            <p class={settingsPage.confirmCopy}>Are you sure you want to sign out?</p>
            <div class={settingsPage.confirmActions}>
              <button class={settingsPage.confirmCancel} data-settings-cancel type="button">
                Cancel
              </button>
              <button
                class={settingsPage.confirmSignOut}
                data-settings-confirm-signout
                type="button"
              >
                Sign out
              </button>
            </div>
          </div>
        </section>
      </div>
    </PageFrame>
  );
}
