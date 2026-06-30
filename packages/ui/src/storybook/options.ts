import type { TextFieldType } from "../components/text-field.types";

const buttonVariantOptions = [
  "default",
  "destructive",
  "ghost",
  "link",
  "outline",
  "secondary",
] as const;

const buttonSizeOptions = ["default", "sm", "lg", "icon"] as const;

const inputTypeOptions = ["text", "email", "password", "search", "number", "tel", "url"] as const;

const textFieldTypeOptions = [
  "text",
  "email",
  "password",
  "search",
] satisfies readonly TextFieldType[];

const checkboxStateOptions = [true, false, "indeterminate"] as const;

const switchSizeOptions = ["default", "sm"] as const;
const drawerDirectionOptions = ["top", "bottom", "left", "right"] as const;
const loadingSizeOptions = ["sm", "md", "lg", "xl", "2xl", "3xl"] as const;
const codeBlockLanguageOptions = [
  "typescript",
  "tsx",
  "javascript",
  "jsx",
  "python",
  "bash",
  "sql",
  "json",
  "html",
  "css",
  "yaml",
  "dockerfile",
  "markdown",
  "graphql",
] as const;

export {
  buttonSizeOptions,
  buttonVariantOptions,
  checkboxStateOptions,
  codeBlockLanguageOptions,
  drawerDirectionOptions,
  inputTypeOptions,
  loadingSizeOptions,
  switchSizeOptions,
  textFieldTypeOptions,
};
