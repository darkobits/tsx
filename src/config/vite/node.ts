import path from 'path';

import {
  EXTENSIONS,
  getSourceAndOutputDirectories
} from '@darkobits/ts';
// eslint-disable-next-line import/default
import checkerPlugin from 'vite-plugin-checker';
import tsconfigPathsPlugin from 'vite-tsconfig-paths';

import log from 'lib/log';
import { gitDescribe } from 'lib/utils';
import { createViteConfigurationPreset } from 'lib/vite';

/**
 * Preset for bundling a project as a Node library. The entry-point will be
 * inferred from the host project's package.json's "main" field.
 *
 * TODO: Consider using vite-plugin-build for this preset.
 */
export default createViteConfigurationPreset(async ({ config, mode, pkg }) => {
  const { srcDir, outDir } = await getSourceAndOutputDirectories();


  // ----- Environment ---------------------------------------------------------

  config.define = {
    'import.meta.env.GIT_DESC': JSON.stringify(await gitDescribe()),
    'import.meta.env.NODE_ENV': JSON.stringify(mode)
  };


  // ----- Input / Output ------------------------------------------------------

  // Enable source maps.
  config.build.sourcemap = true;

  config.build.lib = {
    entry: '',
    formats: ['cjs', 'es']
  };

  // Infer the project's entry point by introspecting its package.json and
  // tsconfig.json files.
  if (srcDir && outDir) {
    config.build.lib.entry = pkg.json.main
      // ? path.resolve(pkg.rootDir, pkg.json.main).replace(outDir, srcDir)
      ? path.resolve(pkg.rootDir, pkg.json.main?.replace(outDir, srcDir))
      : path.resolve(pkg.rootDir, srcDir, 'index');

    config.build.lib.fileName = path.basename(config.build.lib.entry);

    log.verbose(log.prefix('config.build.lib.entry'), log.chalk.green(config.build.lib.entry));
    log.verbose(log.prefix('config.build.lib.fileName'), log.chalk.green(config.build.lib.fileName));
  } else {
    log.verbose(log.prefix('config.build.lib.entry'), log.chalk.red('Unable to infer from tsconfig.json; set explicitly in vite.config.ts.'));
    log.verbose(log.prefix('config.build.lib.fileName'), log.chalk.red('Unable to infer from tsconfig.json; set explicitly in vite.config.ts.'));
  }

  config.build.rollupOptions.external = Object.keys(pkg.json.dependencies ?? []);


  // ----- Plugins -------------------------------------------------------------

  // Enable fast in-band TypeScript and ESLint support using separate worker
  // threads.
  config.plugins.push(checkerPlugin({
    typescript: true,
    eslint: {
      lintCommand: `eslint ${path.resolve(config.root)} --ext=${EXTENSIONS.join(',')}`
    }
  }));

  // Add support for TypeScript path mappings.
  // See: https://github.com/aleclarson/vite-tsconfig-paths
  config.plugins.push(tsconfigPathsPlugin({
    projects: [config.root]
  }));
});
