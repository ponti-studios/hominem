// The launch overlay and the login screen draw the same mascot + wordmark group. The overlay starts it
// centred on the screen (matching the native splash image) and moves it to where the login screen lays
// it out, so both sides compute positions from these numbers.

const MASCOT_ASPECT = 1295 / 1214; // omiro-auth-mascot.png, height over width

export const LOGIN_MASCOT_WIDTH = 112;
export const LOGIN_MASCOT_HEIGHT = LOGIN_MASCOT_WIDTH * MASCOT_ASPECT;

// Must equal `imageWidth` for expo-splash-screen in app.config.js so the native splash and the
// in-app overlay show the mascot at the same size.
export const LAUNCH_MASCOT_WIDTH = 150;
export const LAUNCH_SCALE = LAUNCH_MASCOT_WIDTH / LOGIN_MASCOT_WIDTH;

const WORDMARK_GAP = 6;
export const WORDMARK_HEIGHT = 32;
export const BRAND_HEIGHT = LOGIN_MASCOT_HEIGHT + WORDMARK_GAP + WORDMARK_HEIGHT;
export const BRAND_GAP = WORDMARK_GAP;

// Space under the brand reserved for the mascot's speech bubble, so a longer translation wraps
// inside this box instead of pushing the form down.
export const BUBBLE_SLOT_HEIGHT = 64;

const BRAND_TOP_GAP = 32;

export function loginBrandTop(insetTop: number) {
  return insetTop + BRAND_TOP_GAP;
}

// Where the brand group's transform origin (its centre) must move so the mascot, not the whole group,
// sits at the middle of the screen: the mascot's centre is above the group's centre by this much.
const MASCOT_CENTRE_OFFSET = BRAND_HEIGHT / 2 - LOGIN_MASCOT_HEIGHT / 2;

export function launchTranslateY({
  insetTop,
  windowHeight,
}: {
  insetTop: number;
  windowHeight: number;
}) {
  const groupCentre = loginBrandTop(insetTop) + BRAND_HEIGHT / 2;
  return windowHeight / 2 - groupCentre + MASCOT_CENTRE_OFFSET * LAUNCH_SCALE;
}
