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


export default createViteConfigurationPreset(async ({ config, mode, pkg }) => {
  const { srcDir, outDir } = await getSourceAndOutputDirectories();


  // ----- Environment ---------------------------------------------------------

  config.define = {
    'import.meta.env.GIT_DESC': JSON.stringify(await gitDescribe()),
    'import.meta.env.NODE_ENV': JSON.stringify(mode)
  };

  // ----- Input / Output ------------------------------------------------------

  config.build.lib = {
    entry: '',
    formats: ['cjs', 'es']
  };

  if (srcDir && outDir) {
    config.build.lib.entry = pkg.json.main
      ? path.resolve(pkg.rootDir, pkg.json.main).replace(outDir, srcDir)
      : path.resolve(pkg.rootDir, srcDir, 'index');

    config.build.lib.fileName = path.basename(config.build.lib.entry);
  } else {
    log.warn(log.prefix('tsx'), 'Unable to compute config.build.lib.entry and config.build.lib.fileName; tsconfig.json does not define compilerOptions.baseUrl and compilerOptions.outDir');
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
