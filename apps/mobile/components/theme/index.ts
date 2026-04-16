import Box from './Box';
import { makeStylesInternal } from './make-styles';
import theme from './theme';
import { shellTheme } from '../../types/shellTheme';

export { Text } from '~/components/typography/Text';
export { Box, theme, shellTheme };
export type Theme = typeof theme;
export const makeStyles = makeStylesInternal;
