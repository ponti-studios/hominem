import Box from './Box';
import { makeStylesInternal } from './make-styles';
import theme from './theme';

export { Text } from '@hominem/ui/text';
export { Box, theme };
export type Theme = typeof theme;
export const makeStyles = makeStylesInternal;
