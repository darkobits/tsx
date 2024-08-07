import path from 'node:path';

import {
  createViteConfigurationPreset,
  createPluginReconfigurator,
  gitDescribe,
  inferESLintConfigurationStrategy
} from '@darkobits/ts/lib/utils.js';
import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin';
import reactPlugin from '@vitejs/plugin-react';
import bytes from 'bytes';
import ms from 'ms';
import checkerPlugin from 'vite-plugin-checker';
import svgrPlugin from 'vite-plugin-svgr';
import tsconfigPathsPlugin from 'vite-tsconfig-paths';

import { IMPORT_META_ENV } from 'etc/constants';
import {
  createManualChunksHelper,
  createHttpsDevServerHelper
} from 'lib/utils';

import type { ReactPresetContext } from 'etc/types';

// ----- Configuration Preset: React -------------------------------------------

export const react = createViteConfigurationPreset<ReactPresetContext>(async context => {
  // Create and assign utilities to context.
  context.manualChunks = createManualChunksHelper(context);
  context.reconfigurePlugin = createPluginReconfigurator(context.config);
  context.useHttpsDevServer = createHttpsDevServerHelper(context);
  context.bytes = bytes;
  context.ms = ms;

  // Global source map setting used by various plug-ins below.
  const sourceMap = true;

  // ----- Preflight Checks ----------------------------------------------------

  const { root } = context;

  // Compute ESLint configuration strategy.
  // const eslintConfig = await inferESLintConfigurationStrategy(root);

  // ----- Build Configuration -------------------------------------------------

  const { config, srcDir, outDir } = context;

  // This must be set in order for the dev server to work properly.
  config.root = srcDir;

  // Use the inferred output directory defined in tsconfig.json.
  config.build.outDir = path.resolve(root, outDir);

  // Empty the output directory before writing the new compilation to it.
  config.build.emptyOutDir = true;

  // Enable source maps.
  config.build.sourcemap = sourceMap;
  config.build.rollupOptions = config.build.rollupOptions ?? {};

  const assetFileNames = 'assets/[name]-[hash][extname]';
  const entryFileNames = '[name]-[hash].js';
  const chunkFileNames = '[name]-[hash].js';

  const manualChunks = (rawId: string) => (
    rawId.replaceAll('\0', '').includes('node_modules') ? 'vendor' : undefined
  );

  if (Array.isArray(config.build.rollupOptions.output)) {
    config.build.rollupOptions.output.map(outputOptions => {
      return {
        ...outputOptions,
        assetFileNames,
        entryFileNames,
        chunkFileNames,
        manualChunks
      };
    });
  } else {
    config.build.rollupOptions.output = {
      ...config.build.rollupOptions.output,
      assetFileNames,
      entryFileNames,
      chunkFileNames,
      manualChunks
    };
  }

  // ----- Environment ---------------------------------------------------------

  const { mode } = context;

  config.define = {
    ...config.define,
    [`${IMPORT_META_ENV}.NODE_ENV`]: JSON.stringify(mode),
    [`${IMPORT_META_ENV}.GIT_DESC`]: JSON.stringify(gitDescribe())
  };

  // ----- Vitest --------------------------------------------------------------

  const { packageJson, patterns: { SOURCE_FILES, TEST_FILES } } = context;

  config.test = {
    root,
    name: packageJson.name,
    environment: 'jsdom',
    deps: {
      interopDefault: true
    },
    coverage: {
      all: true,
      include: [SOURCE_FILES]
    },
    include: [TEST_FILES]
  };

  // ----- Plugin: React -------------------------------------------------------

  config.plugins.push(reactPlugin());

  // ----- Plugin: tsconfig-paths ----------------------------------------------

  /**
   * This plugin allows Rollup to resolve import/require specifiers in source
   * files using path mappings configured in tsconfig.json.
   *
   * Note: Because Vite does not process declaration files emitted by
   * TypeScript, we will need to resolve those import/export specifiers
   * separately.
   *
   * See: https://github.com/aleclarson/vite-tsconfig-paths
   */
  config.plugins.push(tsconfigPathsPlugin({ root }));

  // ----- Plugin: Vanilla Extract ---------------------------------------------

  /**
   * Vanilla Extract is our build-time CSS-in-JS library.
   *
   * See: https://vanilla-extract.style
   */
  config.plugins.push(vanillaExtractPlugin());

  // ----- Plugin: svgr --------------------------------------------------------
  /**
   * svgr allows projects to import SVGs as React components.
   *
   * See: https://github.com/pd4d10/vite-plugin-svgr
   */
  config.plugins.push(svgrPlugin({
    svgrOptions: {
      // Replace SVG `width` and `height` value by `1em` in order to make SVG
      // size inherit from text size.
      icon: true,
      // Memoize components.
      memo: true
    }
  }));

  // ----- Plugin: Checker -----------------------------------------------------

  type CheckerPluginESLintConfig = NonNullable<Parameters<typeof checkerPlugin>[0]['eslint']>;

  // By default, disable ESLint support for the checker plugin.
  let eslint: CheckerPluginESLintConfig = false;

  // Then, enable ESLint in the checker plugin if this is _not_ a test run.
  if (mode !== 'test') {
    // Determine if the host project is using a legacy .eslintrc.js
    // configuration file or the newer eslint.config.js format.
    const eslintConfigStrategy = await inferESLintConfigurationStrategy(root);

    // Only proceed if the host project has any ESLint configuration file
    // present.
    if (eslintConfigStrategy) {
      const { type, configFile } = eslintConfigStrategy;

      if (type === 'legacy') eslint = {
        lintCommand: `eslint "${SOURCE_FILES}" --config=${configFile}`
      };

      if (type === 'flat') eslint = {
        lintCommand: `ESLINT_USE_FLAT_CONFIG=true eslint --config=${configFile}`,
        // Currently, the checker plugin requires some additional parameters to
        // work with eslint.config.js configuration files.
        dev: { overrideConfig: { overrideConfigFile: configFile } }
      };
    }
  }

  /**
   * This plugin is responsible for type-checking and linting the project. It
   * runs each checker in a worker thread to speed up build times, and uses
   * nice overlays with the Vite dev server. However, it is not as configurable
   * as @rollup/plugin-typescript, so we still need the latter to properly
   * generate declaration files.
   *
   * See: https://github.com/fi3ework/vite-plugin-checker
   */
  config.plugins.push(checkerPlugin({ root, typescript: true, eslint }));

  // ----- Dev Server Configuration --------------------------------------------

  // Bind to all local IP addresses.
  config.server.host = '0.0.0.0';
});
