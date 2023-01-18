import path from 'path';

import {
  EXTENSIONS,
  SRC_DIR,
  OUT_DIR
} from '@darkobits/ts/etc/constants';
// eslint-disable-next-line import/default
import checkerPlugin from 'vite-plugin-checker';
import tsconfigPathsPlugin from 'vite-tsconfig-paths';

import { gitDescribe } from 'lib/utils';
import { createViteConfigurationPreset } from 'lib/vite';


export default createViteConfigurationPreset(async ({ config, mode, pkg }) => {
  // ----- Environment ---------------------------------------------------------

  config.define = {
    'import.meta.env.GIT_DESC': JSON.stringify(await gitDescribe()),
    'import.meta.env.NODE_ENV': JSON.stringify(mode)
  };

  // ----- Input / Output ------------------------------------------------------

  config.build.lib = {
    entry: pkg.json.main
      ? path.resolve(pkg.rootDir, pkg.json.main).replace(OUT_DIR, SRC_DIR)
      : path.resolve(pkg.rootDir, SRC_DIR, 'index'),
    formats: ['cjs', 'es']
  };

  // @ts-expect-error - TODO: Updating dependencies.
  config.build.lib.fileName = path.basename(config.build.lib.entry);

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
