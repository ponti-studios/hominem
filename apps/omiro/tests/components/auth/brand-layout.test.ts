import { describe, expect, it } from 'vitest';

import {
  BRAND_HEIGHT,
  LAUNCH_MASCOT_WIDTH,
  LAUNCH_SCALE,
  LOGIN_MASCOT_HEIGHT,
  LOGIN_MASCOT_WIDTH,
  loginBrandTop,
  launchTranslateY,
} from '~/components/auth/brand-layout';

describe('launch overlay geometry', () => {
  it('scales the login mascot up to the native splash size', () => {
    expect(LOGIN_MASCOT_WIDTH * LAUNCH_SCALE).toBeCloseTo(LAUNCH_MASCOT_WIDTH);
  });

  // The native splash centres the mascot on the screen. The overlay starts from the same spot, so the
  // mascot's centre after the launch transform must be the screen's centre, on any device.
  it.each([
    { insetTop: 20, windowHeight: 667 },
    { insetTop: 59, windowHeight: 852 },
    { insetTop: 62, windowHeight: 956 },
  ])('centres the mascot on the screen ($windowHeight pt tall)', (device) => {
    const groupCentre = loginBrandTop(device.insetTop) + BRAND_HEIGHT / 2;
    const mascotOffsetFromGroupCentre = LOGIN_MASCOT_HEIGHT / 2 - BRAND_HEIGHT / 2;
    const mascotCentre =
      groupCentre + launchTranslateY(device) + mascotOffsetFromGroupCentre * LAUNCH_SCALE;

    expect(mascotCentre).toBeCloseTo(device.windowHeight / 2);
  });
});
