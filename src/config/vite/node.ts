import path from 'path';

import env from '@darkobits/env';
import {
  EXTENSIONS_WITH_DOT,
  SRC_DIR,
  OUT_DIR
} from '@darkobits/ts/etc/constants';
import checkerPlugin from 'vite-plugin-checker';
import tsconfigPathsPlugin from 'vite-tsconfig-paths';

import log from 'lib/log';
import { gitDescribe } from 'lib/utils';
import { createViteConfigurationPreset } from 'lib/vite';


export default createViteConfigurationPreset(({ config, mode, pkg }) => {
  const ROOT = env('VITE_ROOT') ?? pkg.rootDir;
  log.verbose(`Using root: ${log.chalk.green(ROOT)}`);

  // ----- Input / Output ------------------------------------------------------

  // TODO: Change this when Vite makes it less awkward to put index.html in
  // a subdirectory like 'src'.
  config.root = path.resolve(ROOT);

  config.build.outDir = path.resolve(ROOT, OUT_DIR);

  config.build.lib = {
    entry: pkg.json.main
      ? path.resolve(ROOT, pkg.json.main).replace(OUT_DIR, SRC_DIR)
      : path.resolve(ROOT, SRC_DIR, 'index'),
    formats: ['cjs', 'es']
  };

  config.build.lib.fileName = path.basename(config.build.lib.entry);

  config.build.rollupOptions.external = Object.keys(pkg.json.dependencies ?? []);


  // ----- Environment ---------------------------------------------------------

  config.define = {
    'process.env.GIT_DESC': JSON.stringify(gitDescribe()),
    'process.env.NODE_ENV': JSON.stringify(mode)
  };


  // ----- Plugins -------------------------------------------------------------

  // Enable fast in-band TypeScript and ESLint support using separate worker
  // threads.
  config.plugins.push(checkerPlugin({
    typescript: true,
    eslint: {
      lintCommand: `eslint ${path.resolve(ROOT, SRC_DIR)} --ext=${EXTENSIONS_WITH_DOT.join(',')}`
    }
  }));

  // Add support for TypeScript path mappings.
  // See: https://github.com/aleclarson/vite-tsconfig-paths
  config.plugins.push(tsconfigPathsPlugin({
    projects: [ROOT]
  }));
});
