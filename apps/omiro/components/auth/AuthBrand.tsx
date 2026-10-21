import { View } from 'react-native';

import { AuthMascot } from './AuthMascot';
import { BRAND_GAP, BRAND_HEIGHT } from './brand-layout';
import { Wordmark } from './Wordmark';

type AuthMascotProps = Parameters<typeof AuthMascot>[0];

interface AuthBrandProps extends AuthMascotProps {
  animateWordmark?: boolean;
  testID?: string;
}

// The mascot over the wordmark. The launch overlay and the login screen both draw it, from the same
// layout numbers, so the one can hand it to the other without a visible swap.
export function AuthBrand({ animateWordmark = false, testID, ...mascot }: AuthBrandProps) {
  return (
    <View style={{ alignItems: 'center', gap: BRAND_GAP, height: BRAND_HEIGHT }}>
      <AuthMascot {...mascot} />
      <Wordmark animate={animateWordmark} testID={testID} />
    </View>
  );
}
