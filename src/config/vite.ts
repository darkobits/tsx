import path from 'path';

import { interopImportDefault } from '@darkobits/interop-import-default';
import {
  createViteConfigurationPreset,
  inferESLintConfigurationStrategy
} from '@darkobits/ts/lib/utils';
import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin';
import reactPlugin from '@vitejs/plugin-react';
import bytes from 'bytes';
import ms from 'ms';
import checkerPluginExport from 'vite-plugin-checker';
import svgrPluginExport from 'vite-plugin-svgr';
import tsconfigPathsPluginExport from 'vite-tsconfig-paths';

import { IMPORT_META_ENV } from 'etc/constants';
import {
  gitDescribe,
  createManualChunksHelper,
  createHttpsDevServerHelper,
  createPluginReconfigurator
} from 'lib/utils';

import type { ReactPresetContext } from 'etc/types';


// Fix default imports from problematic packages.
const checkerPlugin = interopImportDefault(checkerPluginExport);
const tsconfigPathsPlugin = interopImportDefault(tsconfigPathsPluginExport);
const svgrPlugin = interopImportDefault(svgrPluginExport);


// ----- React Configuration Preset --------------------------------------------

export const react = createViteConfigurationPreset<ReactPresetContext>(async context => {
  // Assign helpers exclusive to ReactPresetContext.
  context.bytes = bytes;
  context.ms = ms;
  context.manualChunks = createManualChunksHelper(context);
  context.reconfigurePlugin = createPluginReconfigurator(context);
  context.useHttpsDevServer = createHttpsDevServerHelper(context);

  // Global source map setting used by various plug-ins below.
  const sourceMap = true;


  // ----- Preflight Checks ----------------------------------------------------

  const { root } = context;

  // Compute ESLint configuration strategy.
  const eslintConfig = await inferESLintConfigurationStrategy(root);


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
  config.build.rollupOptions.output = config.build.rollupOptions.output ?? {};

  // This is primarily here for type safety, but right now we don't support
  // multiple outputs.
  if (Array.isArray(config.build.rollupOptions.output))
    throw new Error('[tsx:react] Expected type of "rollupOptions.output" to be "object", got "Array".');

  config.build.rollupOptions.output.assetFileNames = 'assets/[name]-[hash][extname]';
  config.build.rollupOptions.output.entryFileNames = '[name]-[hash].js';
  config.build.rollupOptions.output.chunkFileNames = '[name]-[hash].js';

  // Very simplistic code-splitting strategy that puts any module from
  // node_modules in a "vendor" chunk.
  config.build.rollupOptions.output.manualChunks = rawId => {
    const id = rawId.replaceAll('\0', '');
    if (id.includes('node_modules')) return 'vendor';
  };


  // ----- Environment ---------------------------------------------------------

  const { mode } = context;

  config.define = config.define ?? {};

  config.define[`${IMPORT_META_ENV}.GIT_DESC`] = JSON.stringify(await gitDescribe());
  config.define[`${IMPORT_META_ENV}.NODE_ENV`] = JSON.stringify(mode);


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

  type ESLintConfig = NonNullable<Parameters<typeof checkerPlugin>[0]['eslint']>;

  let eslint: ESLintConfig = false;

  if (mode !== 'test' && eslintConfig) {
    if (eslintConfig.type === 'legacy') {
      eslint = {
        lintCommand: `eslint "${SOURCE_FILES}" --config=${eslintConfig.configFile}`
      };
    } else if (eslintConfig.type === 'flat') {
      eslint = {
        lintCommand: `ESLINT_USE_FLAT_CONFIG=true eslint --config=${eslintConfig.configFile}`,
        dev: {
          overrideConfig: {
            overrideConfigFile: eslintConfig.configFile
          }
        }
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
  config.plugins.push(checkerPlugin({
    typescript: true,
    eslint
  }));


  // ----- Dev Server Configuration --------------------------------------------

  // Bind to all local IP addresses.
  config.server.host = '0.0.0.0';
});
