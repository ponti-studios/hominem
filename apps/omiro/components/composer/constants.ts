import { spacing } from '~/components/theme/tokens';

export const TOOL_BTN_SIZE = 38; // ToolBtn / SecondaryBtn per composer spec
export const PRIMARY_BTN_SIZE = 42; // PrimaryBtn per composer spec
export const TOOLBAR_ICON_SIZE = 20; // toolbar action icon size

// Space the row-mode text input reserves on each side so typed text never
// renders underneath the overlaid attach/mic buttons.
export const ROW_MODE_INPUT_MARGIN = TOOL_BTN_SIZE + spacing[2];
