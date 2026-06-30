import type { Preview } from "@storybook/react-vite";
import { commonControlsExclude } from "../src/storybook/controls";
import "../src/styles.css";

const preview: Preview = {
  globalTypes: {
    colorSystem: {
      name: "Color System",
      description: "Active UI color system",
      defaultValue: "primer",
      toolbar: {
        icon: "paintbrush",
        items: [
          { value: "primer", title: "Primer" },
          { value: "apple", title: "Apple" },
        ],
      },
    },
    colorMode: {
      name: "Color Mode",
      description: "Active UI color mode",
      defaultValue: "system",
      toolbar: {
        icon: "mirror",
        items: [
          { value: "system", title: "System" },
          { value: "light", title: "Light" },
          { value: "dark", title: "Dark" },
        ],
      },
    },
  },
  decorators: [
    (Story, context) => {
      if (typeof document !== "undefined") {
        const root = document.documentElement;
        root.dataset.colorSystem = String(context.globals.colorSystem ?? "primer");

        if (context.globals.colorMode === "system") {
          delete root.dataset.colorMode;
        } else {
          root.dataset.colorMode = String(context.globals.colorMode);
        }
      }

      return <Story />;
    },
  ],
  parameters: {
    layout: "centered",
    controls: {
      exclude: commonControlsExclude,
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
      sort: "requiredFirst",
      expanded: true,
    },
    options: {
      storySort: {
        order: [
          "Audit",
          "Tokens",
          "Primitives",
          "Forms",
          "Feedback",
          "Navigation",
          "Patterns",
          "Surfaces",
          "Layouts",
          "Motion",
          "Internal",
        ],
      },
    },
  },
};

export default preview;
