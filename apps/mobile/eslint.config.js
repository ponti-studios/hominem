// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}", "services/**/*.{ts,tsx}", "tests/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/packages/platform/ui/src/**", "packages/platform/ui/src/**"],
              message: "Import shared UI through @hominem/ui public exports.",
            },
            {
              group: ["lucide-react-native"],
              message: "Use Apple SF Symbols on mobile.",
            },
            {
              group: [
                "~/components/Button",
                "~/components/text-input",
                "~/components/Screen",
                "~/components/ui/EmptyState",
                "~/components/ui/Card",
                "~/components/ui/Badge",
                "~/components/ui/Separator",
                "~/components/ui/Surface",
                "~/components/ui/ListRow",
                "~/components/ui/ListShell",
              ],
              message: "Import shared primitives from @hominem/ui public exports.",
            },
          ],
        },
      ],
    },
  },
]);
