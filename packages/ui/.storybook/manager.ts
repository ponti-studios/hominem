import { addons } from 'storybook/manager-api'
import { create } from 'storybook/theming/create'

const darkTheme = create({
  base: 'dark',
  brandTitle: 'Hominem UI',
  brandUrl: '/',

  colorPrimary: 'rgba(142, 141, 255, 1)',
  colorSecondary: 'rgba(142, 141, 255, 1)',

  appBg: 'rgba(15, 16, 18, 1)',
  appContentBg: 'rgba(17, 17, 19, 1)',
  appPreviewBg: 'rgba(17, 17, 19, 1)',
  appHoverBg: 'rgba(245, 246, 248, 0.08)',
  appBorderColor: 'rgba(245, 246, 248, 0.18)',
  appBorderRadius: 6,

  fontBase:
    "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Helvetica Neue', system-ui, sans-serif",
  fontCode: "'SF Mono', 'Menlo', ui-monospace, monospace",

  textColor: 'rgba(245, 246, 248, 1)',
  textInverseColor: 'rgba(17, 17, 19, 1)',
  textMutedColor: 'rgba(141, 147, 161, 1)',

  barTextColor: 'rgba(180, 185, 195, 1)',
  barHoverColor: 'rgba(245, 246, 248, 1)',
  barSelectedColor: 'rgba(142, 141, 255, 1)',
  barBg: 'rgba(24, 25, 27, 1)',

  buttonBg: 'rgba(245, 246, 248, 0.14)',
  buttonBorder: 'rgba(245, 246, 248, 0.18)',
  booleanBg: 'rgba(33, 34, 37, 1)',
  booleanSelectedBg: 'rgba(142, 141, 255, 1)',

  inputBg: 'rgba(24, 25, 27, 1)',
  inputBorder: 'rgba(245, 246, 248, 0.18)',
  inputTextColor: 'rgba(245, 246, 248, 1)',
  inputBorderRadius: 6,
})

addons.setConfig({ theme: darkTheme })
