import Box from './Box';
import { makeStylesInternal } from './make-styles';
import Text from './Text';
import theme from './theme';

export { Box, Text, theme };
export type Theme = typeof theme;
export const makeStyles = makeStylesInternal;
