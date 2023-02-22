import path from 'path';

import { interopImportDefault } from '@darkobits/interop-import-default';
import tscAliasPlugin from '@darkobits/ts/lib/tsc-alias-plugin';
import { createViteConfigurationPreset } from '@darkobits/ts/lib/utils';
import typescriptPlugin from '@rollup/plugin-typescript';
import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin';
import reactPlugin from '@vitejs/plugin-react';
import bytes from 'bytes';
import glob from 'fast-glob';
import ms from 'ms';
import checkerPluginExport from 'vite-plugin-checker';
import svgrPlugin from 'vite-plugin-svgr';
import tsconfigPathsPluginExport from 'vite-tsconfig-paths';

import { IMPORT_META_ENV } from 'etc/constants';
import log from 'lib/log';
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


// ----- React Configuration Preset --------------------------------------------

export const react = createViteConfigurationPreset<ReactPresetContext>(async context => {
  const {
    root,
    mode,
    config,
    srcDir,
    outDir,
    packageJson,
    tsConfigPath,
    patterns: {
      SOURCE_FILES,
      TEST_FILES
    }
  } = context;

  // Assign helpers exclusive to ReactPresetContext.
  context.bytes = bytes;
  context.manualChunks = createManualChunksHelper(context);
  context.ms = ms;
  context.reconfigurePlugin = createPluginReconfigurator(context);
  context.useHttpsDevServer = createHttpsDevServerHelper(context);

  // Global source map setting used by various plug-ins below.
  const sourceMap = true;


  // ----- Preflight Checks ----------------------------------------------------

  // Compute anything we need to use async for concurrently.
  const [eslintConfigResult] = await Promise.all([
    glob(['.eslintrc.*'], { cwd: root })
  ]);


  // ----- Build Configuration -------------------------------------------------

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

  // Very simplistic code-splitting strategy that simply puts any module from
  // the node_modules folder in a "vendor" chunk.
  config.build.rollupOptions.output.manualChunks = (rawId: string) => {
    const id = rawId.replace(/\0/g, '');
    if (id.includes('node_modules')) return 'vendor';
  };


  // ----- Server Configuration ------------------------------------------------

  // Bind to all local IP addresses.
  config.server.host = '0.0.0.0';


  // ----- Environment ---------------------------------------------------------

  config.define = config.define ?? {};

  config.define[`${IMPORT_META_ENV}.GIT_DESC`] = JSON.stringify(await gitDescribe());
  config.define[`${IMPORT_META_ENV}.NODE_ENV`] = JSON.stringify(mode);


  // ----- Vitest Configuration ------------------------------------------------

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


  // ----- Plugin: TypeScript --------------------------------------------------

  /**
   * This plugin is used to emit declaration files _only_. Its error reporting
   * UX is less than ideal, so we rely on vite-plugin-checker for type-checking.
   */
  config.plugins.push(typescriptPlugin({
    exclude: [TEST_FILES],
    compilerOptions: {
      // The user should have set either rootDir or baseUrl in their
      // tsconfig.json, but we actually need _both_ to be set to the same
      // value to ensure TypeScript compiles declarations properly.
      rootDir: srcDir,
      baseUrl: srcDir,
      // This plugin will issue a warning if this is set to any other value.
      // Because we are only using this plugin to output declaration files, this
      // setting has no effect on source output.
      module: 'esnext',
      // Ensure we only emit declaration files; all other source should be
      // processed by Vite/Rollup.
      emitDeclarationOnly: true,
      // Do not fail if an error is encountered; vite-plugin-checker will handle
      // error reporting.
      noEmitOnError: false,
      // If we have `config.build.sourcemap` set to `true`, this must also be
      // `true` or the plugin will issue a warning.
      sourceMap: config.build.sourcemap
    }
  }));


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


  // ----- Plugin: tsc-alias ---------------------------------------------------

  /**
   * This plugin is responsible for resolving and re-writing import/export
   * specifiers in emitted declaration files. Note that it _does_ scan the
   * entire output directory and will also re-write specifiers in emitted source
   * files, but this operation is redundant; source specifiers will have already
   * been re-written by tsconfig-paths (see above).
   *
   * See: https://github.com/justkey007/tsc-alias
   */
  config.plugins.push(tscAliasPlugin({
    configFile: tsConfigPath,
    debug: log.isLevelAtLeast('silly')
  }));


  // ----- Plugin: React -------------------------------------------------------

  config.plugins.push(reactPlugin());


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

  const hasEslintConfig = eslintConfigResult.length > 0;

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
    eslint: hasEslintConfig && mode !== 'test'
      ? { lintCommand: `eslint "${SOURCE_FILES}"` }
      : false
  }));
});
