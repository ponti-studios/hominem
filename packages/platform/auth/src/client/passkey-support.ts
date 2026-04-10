type PasskeyBrowser = {
  PublicKeyCredential?: unknown;
  navigator?: {
    webdriver?: boolean;
  };
};

export function hasPasskeySupport(browser: PasskeyBrowser | undefined) {
  return Boolean(browser?.PublicKeyCredential) && browser?.navigator?.webdriver !== true;
}
