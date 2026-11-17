import { StyleSheet, View } from 'react-native';

import { useAppTheme, withAlpha } from '~/components/theme';

// The ground wash for root screens: three soft colour pools over the full
// screen, so the page is one continuous surface and the glass bar and composer
// sit on it edge to edge. Static, one view, no blur.
export function AuroraBackground() {
  const { aurora1, aurora2, aurora3 } = useAppTheme().colors;
  const pool = (color: string, alpha: number, at: string, reach: number) =>
    `radial-gradient(circle at ${at}, ${withAlpha(color, alpha)} 0%, ${withAlpha(color, 0)} ${reach}%)`;
  return (
    <View
      pointerEvents="none"
      style={[
        styles.wash,
        {
          experimental_backgroundImage: [
            pool(aurora1, 0.55, '10% 0%', 55),
            pool(aurora2, 0.45, '95% 10%', 50),
            pool(aurora3, 0.35, '55% 45%', 55),
          ].join(', '),
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  wash: { bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 },
});
