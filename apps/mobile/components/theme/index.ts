import { makeStylesInternal } from './make-styles';
import theme from './theme';
import { shellTheme } from '../../types/shellTheme';

export { Text } from './typography';
export { theme, shellTheme };
export type { Theme } from './theme';
export const makeStyles = makeStylesInternal;
