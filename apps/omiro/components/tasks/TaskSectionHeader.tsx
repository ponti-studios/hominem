import { Text, View } from 'react-native';

import { useStyles } from '~/components/theme';

interface TaskSectionHeaderProps {
  title: string;
  detail?: string;
}

export function TaskSectionHeader({ title, detail }: TaskSectionHeaderProps) {
  const styles = useStyles((theme) => ({
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 4,
      paddingTop: 10,
    },
    title: {
      ...theme.textVariants.footnote,
      color: theme.colors.mutedForeground,
      fontWeight: '700',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
    detail: {
      ...theme.textVariants.footnote,
      color: theme.colors.mutedForeground,
      fontWeight: '600',
    },
  }));
  return (
    <View style={styles.row}>
      <Text style={styles.title}>{title}</Text>
      {detail ? <Text style={styles.detail}>{detail}</Text> : null}
    </View>
  );
}
