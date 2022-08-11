import path from 'path';

import {
  SRC_DIR,
  OUT_DIR
} from '@darkobits/ts/etc/constants';
import { getPackageInfo } from '@darkobits/ts/lib/utils';
import bytes from 'bytes';
import merge from 'deepmerge';
import { set as setProperty } from 'dot-prop';
import { isPlainObject } from 'is-plain-object';
import ms from 'ms';
import inspect from 'vite-plugin-inspect';

import log from 'lib/log';

import type {
  ManualChunksFn,
  ManualChunkSpec,
  VendorOnlyChunkSpec,
  ViteConfiguration,
  ViteConfigurationFactory,
  ViteConfigurationFnContext
} from 'etc/types';
import type { UserConfigFn, PluginOption } from 'vite';


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
      emptyOutDir: true,
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
 * @private
 *
 * Uses duck-typing to determine if the provided value is Promise-like.
 */
function isPromise(value: any): value is PromiseLike<any> {
  return Reflect.has(value, 'then') && Reflect.has(value, 'catch');
}


/**
 * @private
 *
 * Provided a Vite configuration object, returns a function that accepts a
 * plugin name and configuration object. The function then finds the plugin and
 * merges the provided configuration object with the plugin's existing
 * configuration.
 */
function createPluginReconfigureFn(config: ViteConfiguration) {
  return async (newPluginReturnValue: PluginOption) => {
    if (!config) return;

    // For type-checking.
    // if (!config.plugins) config.plugins = [];

    const existingPluginsAsFlatArray = config.plugins?.flat(1);

    // A plugin factory can return a single plugin instance or an array of
    // plugins. Since we accept a plugin factory's return value, coerce the
    // incoming value to an array so we can deal with it uniformly.
    const newPluginsAsFlatArray = Array.isArray(newPluginReturnValue)
      ? newPluginReturnValue.flat(1)
      : [newPluginReturnValue];

    // Iterate over each _new_ plugin object and attempt to find its
    // corresponding value in the current plugin configuration.
    for (const newPlugin of newPluginsAsFlatArray) {
      let pluginFound = false;

      const resolvedPlugin = isPromise(newPlugin) ? await newPlugin : newPlugin;

      if (!resolvedPlugin) continue;

      // Only necessary for TypeScript; the PluginOption type contains a
      // recursive reference to an array of itself, so no amount of flattening
      // will ever allow us to narrow this to a non-array type.
      if (Array.isArray(resolvedPlugin)) {
        throw new TypeError('[reconfigurePlugin] Unexpected: Found an array in a flattened list of plugins');
      }

      for (let i = 0; i < existingPluginsAsFlatArray.length; i++) {
        const existingPlugin = existingPluginsAsFlatArray[i];

        const resolvedExistingPlugin = isPromise(existingPlugin)
          ? await existingPlugin
          : existingPlugin;

        if (!resolvedExistingPlugin) continue;
        if (Array.isArray(resolvedExistingPlugin)) continue;

        if (resolvedPlugin.name === resolvedExistingPlugin.name) {
          pluginFound = true;
          existingPluginsAsFlatArray[i] = newPlugin;
          log.verbose(log.prefix('reconfigurePlugin'), `Reconfigured plugin: ${resolvedExistingPlugin.name}`);
          break;
        }
      }

      if (!pluginFound) {
        throw new Error(`[reconfigurePlugin] Unable to find an existing plugin instance for ${resolvedPlugin.name}`);
      }
    }

    config.plugins = existingPluginsAsFlatArray;
  };
}


/**
 * @private
 *
 * Type predicate to narrow `ManualChunkSpec` to one of its sub-types.
 */
function isVendorOnlyChunkSpec(value: ManualChunkSpec): value is VendorOnlyChunkSpec {
  return !Reflect.has(value, 'include');
}


/**
 * @private
 *
 * Factory that creates a `manualChunks` function bound to the provided
 * configuration object. This function will be included in the context object
 * passed to configuration functions.
 */
function createManualChunksHelper(config: ViteConfiguration): ManualChunksFn {
  if (!config.build.rollupOptions.output) {
    config.build.rollupOptions.output = {};
  }

  // N.B. This is the function that users will invoke in their configuration.
  return (chunks: Array<ManualChunkSpec>) => {
    if (config.build.rollupOptions.output.manualChunks) {
      log.warn(log.prefix('manualChunks'), 'A `manualChunks` function has already been set; overwriting it.');
    }

    // N.B. This is the function that Vite will internally invoke to determine
    // what chunk a module should be sorted into.
    setProperty(config, 'build.rollupOptions.output.manualChunks', (rawId: string) => {
      const id = rawId.replace(/\0/g, '');

      for (const chunkSpec of chunks) {
        // For vendor only chunks (without an `include` field) we can return
        // whether the module ID includes 'node_modules'.
        if (isVendorOnlyChunkSpec(chunkSpec)) {
          return id.includes('node_modules') ? chunkSpec.name : undefined;
        }

        // For explicit chunk specs that have the `vendor` flag set, we can
        // immediately bail if the module ID does not include 'node_modules'.
        if (chunkSpec.vendor && !id.includes('node_modules')) {
          return;
        }

        // At this point we are dealing with explicit chunk specs where:
        // - The `vendor` field was falsy, or
        // - The `vendor` field was truthy, and we already know that the module
        //   ID includes 'node_modules'.
        for (const include of chunkSpec.include) {
          if (typeof include === 'string' && id.includes(include)) {
            // console.debug('!', id, '->', chunkSpec.name);
            return chunkSpec.name;
          } if (include instanceof RegExp && include.test(id)) {
            // console.debug('!', id, '->', chunkSpec.name);
            return chunkSpec.name;
          }
        }
      }
    });
  };
}


/**
 * Function that accepts a "base" 'tsx' Vite configuration factory and
 * returns a function that accepts a user-provided 'tsx' Vite configuration
 * factory, then returns a 'standard' Vite configuration factory that will be
 * passed to Vite.
 */
export const createViteConfigurationPreset = (
  baseConfigFactory: ViteConfigurationFactory
) => (
  userConfigFactory?: ViteConfigurationFactory
): UserConfigFn => async ({ command, mode }) => {
  // Get host package metadata.
  const pkg = await getPackageInfo();

  const context: Omit<ViteConfigurationFnContext, 'config' | 'reconfigurePlugin' | 'manualChunks'> = {
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
    reconfigurePlugin: createPluginReconfigureFn(baseConfigScaffold),
    manualChunks: createManualChunksHelper(baseConfigScaffold)
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
    reconfigurePlugin: createPluginReconfigureFn(baseConfig),
    manualChunks: createManualChunksHelper(baseConfig)
  });

  // If the factory did not return a value, defer to the baseConfig object we
  // passed-in and modified in-place.
  // const userConfig = returnedUserConfig ?? userConfigScaffold;
  const userConfig = returnedUserConfig ?? baseConfig;


  // ----- Merge Configurations ------------------------------------------------

  const finalConfig = merge(baseConfig, userConfig, {
    customMerge: (key: string) => (a: any, b: any) => {
      // Concatenate plugin arrays.
      if (key === 'plugins') {
        return [...a, ...b];
      }

      // Concatenate plain objects, overwriting root-level keys.
      if (isPlainObject(a) && isPlainObject(b)) {
        return {...a, ...b};
      }

      // For all other arrays, return the value from the second object.
      if (Array.isArray(a) || Array.isArray(b)) {
        log.warn(`[${key}] Encountered arrays:`, a, b);
        return b;
      }


      // For all other values, issue a warning and return the first value.
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
