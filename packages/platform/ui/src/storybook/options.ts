import type { ButtonSize, ButtonVariant } from '../components/ui/button.types';
import type { TextFieldType } from '../components/ui/text-field.types';

const buttonVariantOptions = [
  'default',
  'primary',
  'destructive',
  'ghost',
  'link',
  'outline',
  'secondary',
] satisfies readonly ButtonVariant[];

const buttonSizeOptions = [
  'default',
  'md',
  'xs',
  'sm',
  'lg',
  'icon',
  'icon-xs',
  'icon-sm',
  'icon-lg',
] satisfies readonly ButtonSize[];

const inputTypeOptions = ['text', 'email', 'password', 'search', 'number', 'tel', 'url'] as const;

const textFieldTypeOptions = [
  'text',
  'email',
  'password',
  'search',
] satisfies readonly TextFieldType[];

const checkboxStateOptions = [true, false, 'indeterminate'] as const;

const switchSizeOptions = ['default', 'sm'] as const;
const drawerDirectionOptions = ['top', 'bottom', 'left', 'right'] as const;
const loadingSizeOptions = ['sm', 'md', 'lg', 'xl', '2xl', '3xl'] as const;
const codeBlockLanguageOptions = [
  'typescript',
  'tsx',
  'javascript',
  'jsx',
  'python',
  'bash',
  'sql',
  'json',
  'html',
  'css',
  'yaml',
  'dockerfile',
  'markdown',
  'graphql',
] as const;
const plaidStatusOptions = ['active', 'error', 'pending_expiration', 'revoked', null] as const;

export {
  buttonSizeOptions,
  buttonVariantOptions,
  checkboxStateOptions,
  codeBlockLanguageOptions,
  drawerDirectionOptions,
  inputTypeOptions,
  loadingSizeOptions,
  plaidStatusOptions,
  switchSizeOptions,
  textFieldTypeOptions,
};
