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
              group: ["**/packages/ui/src/**", "packages/ui/src/**"],
              message: "Import shared UI through @hominem/ui public exports.",
            },
            {
              group: ["lucide-react-native"],
              message: "Use Apple SF Symbols on mobile.",
            }
          ],
        },
      ],
    },
  },
]);
