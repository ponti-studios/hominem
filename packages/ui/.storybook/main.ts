import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineMain } from '@storybook/react-vite/node';
import tailwindcss from '@tailwindcss/vite';
import { createLogger } from 'vite';

export default defineMain({
  features: {
    experimentalTestSyntax: true,
  },
  tags: {
    _test: {
      defaultFilterSelection: 'exclude',
    },
    experimental: {
      defaultFilterSelection: 'exclude',
    },
  },
  staticDirs: ['../public'],
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: [
    getAbsolutePath('@storybook/addon-docs'),
    getAbsolutePath('@storybook/addon-vitest'),
    getAbsolutePath('@storybook/addon-mcp'),
  ],
  framework: {
    name: getAbsolutePath('@storybook/react-vite'),
    options: {},
  },
  docs: {
    defaultName: 'Documentation',
  },
  typescript: {
    reactDocgen: 'react-docgen-typescript',
    reactDocgenTypescriptOptions: {
      propFilter: (prop) => (prop.parent ? !prop.parent.fileName.includes('node_modules') : true),
    },
  },
  viteFinal: async (config) => {
    const existingOnWarn = config.build?.rollupOptions?.onwarn;
    const logger = createLogger(config.logLevel, { allowClearScreen: false });
    const loggerWarn = logger.warn;

    logger.warn = (message, options) => {
      if (message.includes('Module level directives cause errors when bundled, "use client"')) {
        return;
      }

      loggerWarn(message, options);
    };

    config.plugins = [tailwindcss(), ...(config.plugins ?? [])];
    config.customLogger = logger;
    config.resolve = config.resolve ?? {};
    config.resolve.tsconfigPaths = true;
    config.build = config.build ?? {};
    config.build.rollupOptions = config.build.rollupOptions ?? {};
    config.build.rollupOptions.onwarn = (warning, warn) => {
      if (warning.code === 'MODULE_LEVEL_DIRECTIVE' && warning.message.includes("'use client'")) {
        return;
      }

      if (existingOnWarn) {
        existingOnWarn(warning, warn);
        return;
      }

      warn(warning);
    };
    return config;
  },
});

function getAbsolutePath(value: string) {
  return dirname(fileURLToPath(import.meta.resolve(`${value}/package.json`)));
}
