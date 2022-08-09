import path from 'path';

import {
  SRC_DIR,
  OUT_DIR
} from '@darkobits/ts/etc/constants';
import { getPackageInfo } from '@darkobits/ts/lib/utils';
import bytes from 'bytes';
import merge from 'deepmerge';
import { isPlainObject } from 'is-plain-object';
import ms from 'ms';
import inspect from 'vite-plugin-inspect';

import {
  ViteConfiguration,
  ViteConfigurationFactory,
  ViteConfigurationFnContext
} from 'etc/types';
import log from 'lib/log';

import type { UserConfigFn } from 'vite';


/**
 * @private
 *
 * Tracks build time.
 */
const runTime = log.createTimer();


/**
 * Finds the directory at or above `process.cwd()` that contains a Vite
 * configuration file.
 */
export async function getViteRoot() {
  const { findUp } = await import('find-up');
  const viteConfigResults = await Promise.all([
    findUp('vite.config.js', { cwd: process.cwd() }),
    findUp('vite.config.ts', { cwd: process.cwd() })
  ]);

  const viteConfigPath = viteConfigResults.filter(Boolean).pop();

  if (!viteConfigPath) {
    throw new Error(`[tsx::getViteRoot] Unable to locate a Vite configuration file at or above "${process.cwd()}"`);
  }

  const viteRoot = path.dirname(viteConfigPath);

  log.verbose(`Using root: ${log.chalk.green(viteRoot)}`);

  return viteRoot;
}


/**
 * @private
 *
 * Utility that generates a base Vite configuration scaffold with certain common
 * keys/paths pre-defined (and typed as such), reducing the amount of
 * boilerplate the user has to write.
 */
async function generateViteConfigurationScaffold(): Promise<ViteConfiguration> {
  const viteRoot = await getViteRoot();

  return {
    root: path.resolve(viteRoot, SRC_DIR),
    build: {
      outDir: path.resolve(viteRoot, OUT_DIR),
      rollupOptions: {
        output: {},
        plugins: []
      }
    },
    plugins: [],
    resolve: {},
    server: {}
  };
}

/**
 */


/**
 * @private
 *
 * Provided a Vite configuration object, returns a function that accepts a
 * plugin name and configuration object. The function then finds the plugin and
 * merges the provided configuration object with the plugin's existing
 * configuration.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function reconfigurePlugin(config: ViteConfiguration) {
  // TODO(joshua): Re-implement this.
  return (pluginName: string, pluginConfig: any) => {
    log.info(log.prefix('reconfigurePlugin'), pluginName, pluginConfig);
  };
}


/**
 * Function that accepts a "base" 'tsx' Webpack configuration factory and
 * returns a function that accepts a user-provided 'tsx' Webpack configuration
 * factory, then returns a 'standard' Webpack configuration factory that will be
 * passed to Webpack.
 */
export const createViteConfigurationPreset = (
  baseConfigFactory: ViteConfigurationFactory
) => (
  userConfigFactory?: ViteConfigurationFactory
): UserConfigFn => async ({ command, mode }) => {
  // Get host package metadata.
  const pkg = await getPackageInfo();

  const context: Omit<ViteConfigurationFnContext, 'config' | 'reconfigurePlugin'> = {
    command,
    mode,
    pkg,
    bytes,
    ms,
    isProduction: mode === 'production',
    isDevelopment: mode === 'development',
    isDevServer: command === 'serve',
    merge
  };


  // ----- Generate Base Configuration -----------------------------------------

  const baseConfigScaffold = await generateViteConfigurationScaffold();

  // Invoke base config factory passing all primitives from our context plus a
  // reference to our base config scaffold and a plugin re-configurator.
  const returnedBaseConfig = await baseConfigFactory({
    ...context,
    config: baseConfigScaffold,
    reconfigurePlugin: reconfigurePlugin(baseConfigScaffold)
  });

  // If the factory did not return a value, defer to the config object we
  // passed-in and modified in-place.
  const baseConfig = returnedBaseConfig ?? baseConfigScaffold;


  // ----- Generate User Configuration -----------------------------------------

  // N.B. If the user only wants to use the base configuration, they may
  // invoke thus function without any arguments.
  if (!userConfigFactory) {
    return baseConfig;
  }

  // const userConfigScaffold = generateViteConfigurationScaffold();

  const returnedUserConfig = await userConfigFactory({
    ...context,
    config: baseConfig,
    reconfigurePlugin: reconfigurePlugin(baseConfig)
  });

  // If the factory did not return a value, defer to the baseConfig object we
  // passed-in and modified in-place.
  // const userConfig = returnedUserConfig ?? userConfigScaffold;
  const userConfig = returnedUserConfig ?? baseConfig;


  // ----- Merge Configurations ------------------------------------------------

  const finalConfig = merge(baseConfig, userConfig, {
    customMerge: (key: string) => (a: any, b: any) => {
      if (key === 'plugins') {
        return [...a, ...b];
      }

      if (isPlainObject(a) && isPlainObject(b)) {
        return {...a, ...b};
      }

      if (Array.isArray(a) || Array.isArray(b)) {
        log.warn(`[${key}] Encountered arrays:`, a, b);
        return b;
      }

      log.warn(`[${key}] Encountered unknown:`, a, b);

      return a;
    },
    isMergeableObject: isPlainObject
  });


  // ----- Miscellany ----------------------------------------------------------

  if (finalConfig.inspect) {
    finalConfig.plugins.push(inspect());
    log.info(log.prefix('inspect'), `${log.chalk.bold('"vite-plugin-inspect"')} added to compilation.`);
  }

  if (mode === 'production') {
    process.on('exit', code => {
      if (code === 0) {
        log.info(log.prefix('vite'), log.chalk.gray(`Done in ${log.chalk.white(runTime)}. ✨`));
      }
    });
  }


  return finalConfig;
};
