import path from 'path';

import { BARE_EXTENSIONS, TEST_FILE_PATTERNS } from '@darkobits/ts/etc/constants';
import tscAliasPlugin from '@darkobits/ts/lib/tsc-alias-plugin';
import { createViteConfigurationPreset, interopRequireDefault } from '@darkobits/ts/lib/utils';
import typescriptPlugin from '@rollup/plugin-typescript';
import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin';
import reactPlugin from '@vitejs/plugin-react';
import bytes from 'bytes';
import merge from 'deepmerge';
import glob from 'fast-glob';
import ms from 'ms';
import eslintPluginExport from 'vite-plugin-eslint';
import svgrPlugin from 'vite-plugin-svgr';
import tsconfigPathsPluginExport from 'vite-tsconfig-paths';

import {
  gitDescribe,
  createManualChunksHelper,
  createHttpsDevServerHelper
} from 'lib/utils';

import type { ReactPresetContext } from 'etc/types';


// Fix default imports for problematic packages.
const tsconfigPathsPlugin = interopRequireDefault(tsconfigPathsPluginExport, 'vite-tsconfig-paths');
const eslintPlugin = interopRequireDefault(eslintPluginExport, 'vite-plugin-eslint');


// ----- React Configuration ---------------------------------------------------

export const react = createViteConfigurationPreset<ReactPresetContext>(async context => {
  const { mode, config, root, srcDir, outDir, tsConfigPath } = context;

  // Assign helpers.
  context.bytes = bytes;
  context.manualChunks = createManualChunksHelper(context);
  context.merge = merge;
  context.ms = ms;
  context.useHttpsDevServer = createHttpsDevServerHelper(context);

  // Build pattern for source files and test files.
  const SOURCE_FILES = [srcDir, '**', `*.{${BARE_EXTENSIONS.join(',')}}`].join(path.sep);
  const TEST_FILES = [srcDir, '**', `*.{${TEST_FILE_PATTERNS.join(',')}}.{${BARE_EXTENSIONS.join(',')}}`].join(path.sep);

  // Global source map setting used by various plug-ins below.
  const sourceMap = true;


  // ----- Build Configuration -------------------------------------------------

  // Use the inferred output directory defined in tsconfig.json.
  config.build.outDir = outDir;

  config.build.emptyOutDir = true;

  config.build.sourcemap = sourceMap;

  config.build.rollupOptions = config.build.rollupOptions ?? {};
  config.build.rollupOptions.output = config.build.rollupOptions.output ?? {};

  // @ts-expect-error - Unknown property entryFileNames.
  config.build.rollupOptions.output.entryFileNames = '[name]-[hash].js';
  // @ts-expect-error - Unknown property assetFileNames.
  config.build.rollupOptions.output.assetFileNames = 'assets/[name]-[hash][extname]';
  // @ts-expect-error - Unknown property chunkFileNames.
  config.build.rollupOptions.output.chunkFileNames =  '[name]-[hash].js';
  // @ts-expect-error - Unknown property manualChunks.
  config.build.rollupOptions.output.manualChunks = (rawId: string) => {
    const id = rawId.replace(/\0/g, '');
    if (id.includes('node_modules')) return 'vendor';
  };


  // ----- Server Configuration ------------------------------------------------

  config.server.host = true;


  // ----- Environment ---------------------------------------------------------

  config.define = config.define ?? {};
  config.define['import.meta.env.GIT_DESC'] = JSON.stringify(await gitDescribe());
  config.define['import.meta.env.NODE_ENV'] = JSON.stringify(mode);


  // ----- Vitest Configuration ------------------------------------------------

  config.test = {
    environment: 'jsdom',
    deps: {
      interopDefault: true
    },
    coverage: {
      all: true
      // include: entry
    },
    include: [TEST_FILES]
  };


  // ----- Plugin: TypeScript --------------------------------------------------

  // This plugin is responsible for type-checking the project and outputting
  // declaration files. It reads the project's tsconfig.json automatically,
  // so the below configuration is only overrides.
  config.plugins.push(typescriptPlugin({
    exclude: [TEST_FILES],
    compilerOptions: {
      // The user should have set either rootDir or baseUrl in their
      // tsconfig.json, but we actually need both to be set to the same
      // value to ensure Typescript compiles declarations properly.
      rootDir: srcDir,
      baseUrl: srcDir,
      // Suppresses warnings from the plugin. Because we are only using this
      // plugin to output declaration files, this setting has no effect on
      // source output anyway.
      module: 'esnext',
      // Ensure we only emit declaration files; all other source should be
      // processed by Vite/Rollup.
      emitDeclarationOnly: true,
      // Causes the build to fail if type errors are present.
      noEmitOnError: true,
      // If we have build.sourcemap set to `true`, this must also be `true`
      // or the plugin will issue a warning.
      sourceMap
    }
  }));


  // ----- Plugin: ESLint ------------------------------------------------------

  const hasEslintConfig = (await glob(['.eslintrc.*'], { cwd: root })).length > 0;

  // Conditionally add the ESLint plugin to the compilation if the user has an
  // ESLint configuration file present.
  if (hasEslintConfig) {
    config.plugins.push(eslintPlugin({
      // cache: true,
      failOnError: true,
      include: [SOURCE_FILES]
    }));
  }


  // ----- Plugin: tsconfig-paths ----------------------------------------------

  // This plugin allows Rollup to resolve import/require statements in
  // source files by using path mappings configured in the project's
  // tsconfig.json file.
  config.plugins.push(tsconfigPathsPlugin({ root }));


  // ----- Plugin: tsc-alias ---------------------------------------------------

  // This plugin is responsible for resolving import/export statements to
  // relative paths in declaration files after the TypeScript compiler has
  // finished writing them. This is a requirement for the declaration files
  // to work for consumers, and TypeScript will not resolve these paths on
  // its own.
  config.plugins.push(tscAliasPlugin({ configFile: tsConfigPath }));


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
});


/**
 * @deprecated
 */
// export default createViteConfigurationPreset(async ({ config, isDevServer, isProduction, mode }) => {
// ----- Input / Output ------------------------------------------------------

// Creates bundles for each production dependency by name and version. Assets
// and application code are named using hashes.
// if (isProduction) {
//   config.build.rollupOptions.output = {
//     entryFileNames: '[name]-[hash].js',
//     assetFileNames: 'assets/[name]-[hash][extname]',
//     chunkFileNames: '[name]-[hash].js',
//     manualChunks: rawId => {
//       const id = rawId.replace(/\0/g, '');
//       if (id.includes('node_modules')) return 'vendor';
//     }
//   };
// }

// Enable source maps.
// config.build.sourcemap = true;


// ----- Environment ---------------------------------------------------------

// config.define = {
//   'import.meta.env.GIT_DESC': JSON.stringify(await gitDescribe()),
//   'import.meta.env.NODE_ENV': JSON.stringify(mode)
// };


// ----- Plugins -------------------------------------------------------------

// config.plugins.push(reactPlugin());

// Enable fast TypeScript and ESLint support using separate worker threads.
// config.plugins.push(checkerPlugin({
//   typescript: true,
//   eslint: {
//     lintCommand: `eslint ${config.root} --ext=${EXTENSIONS.join(',')}`
//   }
// }));

// Add support for vanilla-extract.
// See: https://vanilla-extract.style
// config.plugins.push(vanillaExtractPlugin());

// Add support for TypeScript path mappings.
// See: https://github.com/aleclarson/vite-tsconfig-paths
// config.plugins.push(tsconfigPathsPlugin({
//   // Note: This does assume that the user's Vite configuration file and
//   // tsconfig.json are in the same directory.
//   projects: [await getViteRoot()]
// }));

// Import SVG assets as React components.
// See: https://github.com/pd4d10/vite-plugin-svgr
// config.plugins.push(svgrPlugin({
//   svgrOptions: {
//     // Replace SVG `width` and `height` value by `1em` in order to make SVG
//     // size inherit from text size.
//     icon: true,
//     // Memoize components.
//     memo: true
//   }
// }));


// ----- Development Server --------------------------------------------------

// if (isDevServer) {
//   // Bind to all available local hosts.
//   config.server.host = true;
// }


// ----- Testing -------------------------------------------------------------

// Set Vitest's environment to 'jsdom' for testing React components.
// config.test = {
//   environment: 'jsdom'
// };


// ----- Hacks ---------------------------------------------------------------

/**
   * See: https://github.com/vitejs/vite/discussions/5079#discussioncomment-1890839
   */
// if (isProduction) {
//   config.css = {
//     postcss: {
//       plugins: [{
//         postcssPlugin: 'internal:charset-removal',
//         AtRule: {
//           charset: atRule => {
//             if (atRule.name === 'charset') atRule.remove();
//           }
//         }
//       }]
//     }
//   };

// TODO: The above hack may be remedied by this simpler solution.
// See: https://github.com/vitejs/vite/discussions/5079#discussioncomment-1690405
// config.css = {
//   preprocessorOptions: {
//     css: {
//       charset: false
//     }
//   }
// };
//   }
// });
