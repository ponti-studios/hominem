import { PropsWithChildren } from 'react';
import { Box } from '~/components/theme';

export const Screen = ({ children }: PropsWithChildren) => {
  return <Box flex={1}>{children}</Box>;
};
