import os from 'os';

import devcert from 'devcert';

import log from 'lib/log';

import type { ConfigurationContext } from '@darkobits/ts/etc/types';
import type {
  ManualChunksFn,
  ManualChunkSpec,
  VendorOnlyChunkSpec
} from 'etc/types';
import type { PluginOption } from 'vite';


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
 * Type predicate to narrow `ManualChunkSpec` to one of its sub-types.
 */
function isVendorOnlyChunkSpec(value: ManualChunkSpec): value is VendorOnlyChunkSpec {
  return !Reflect.has(value, 'include');
}


/**
 * Returns an array of all local IP addresses for the host machine.
 */
export function getLocalIpAddresses() {
  return Object.values(os.networkInterfaces()).flatMap(interfaces => {
    return interfaces?.map(i => (i.family === 'IPv4' ? i.address : false)).filter(Boolean);
  }) as Array<string>;
}


/**
 * Provided a Vite configuration object, returns a function that accepts a
 * plugin name and configuration object. The function then finds the plugin and
 * merges the provided configuration object with the plugin's existing
 * configuration.
 *
 * TODO: Move to `ts`.
 */
export function createPluginReconfigurator(context: ConfigurationContext) {
  const { config } = context;

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
        throw new TypeError('[tsx:reconfigurePlugin] Unexpected: Found an array in a flattened list of plugins');
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
        throw new Error(`[tsx:reconfigurePlugin] Unable to find an existing plugin instance for ${resolvedPlugin.name}`);
      }
    }

    config.plugins = existingPluginsAsFlatArray;
  };
}


/**
 * Provided a Vite ConfigurationContext, returns a function bound to the
 * context's configuration. This function may then be invoked by the user in
 * their Vite configuration file to configure code-splitting.
 *
 * The function accepts an array of chunk specifications and patterns that. If
 * an imported module's resolved path matches one of a chunk's patterns, the
 * module will be sorted into that chunk. If a module fails to match against any
 * chunk spec, it will be placed in the last chunk in the list.
 *
 * @example
 *
 * ```
 * manualChunks([{
 *   // Base name of the file for this chunk.
 *   name: 'react',
 *   // Optional. Ensures modules that match are from `node_modules`.
 *   vendor: true,
 *   // List of strings or regular expressions to match module identifiers
 *   // against.
 *   include: [
 *     'react',
 *     'react-dom',
 *     'object-assign',
 *     'scheduler'
 *   ]
 * }, {
 *   // Shorthand spec definition that will simply include all modules from
 *   // `node_modules` that did not match a previous spec. If used, this
 *   // should be defined last.
 *   name: 'vendor',
 *   vendor: true
 * }]);
 * ```
 */
export function createManualChunksHelper(context: ConfigurationContext): ManualChunksFn {
  const { config } = context;

  // N.B. This is the function that users will invoke in their configuration.
  return chunkSpecs => {
    // N.B. This is the function that Vite will internally invoke to determine
    // what chunk a module should be sorted into.
    config.build.rollupOptions = config.build.rollupOptions ?? {};
    config.build.rollupOptions.output = config.build.rollupOptions.output ?? {};

    // This is primarily here for type safety, but right now we don't support
    // multiple outputs.
    if (Array.isArray(config.build.rollupOptions.output))
      throw new Error('[tsx:createManualChunksHelper] Expected type of "rollupOptions.output" to be "object", got "Array".');

    config.build.rollupOptions.output.manualChunks = rawId => {
      const id = rawId.replaceAll('\0', '');

      for (const chunkSpec of chunkSpecs) {
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
            return chunkSpec.name;
          } if (include instanceof RegExp && include.test(id)) {
            return chunkSpec.name;
          }
        }
      }
    };
  };
}


/**
 * Provided a Vite `ConfigurationContext`, returns a function that, when
 * invoked, determines if Vite is in development mode and, if so, configures the
 * development server to use HTTPS. The [`devcert`](https://github.com/davewasmer/devcert)
 * package is used to generate self-signed certificates.
 */
export function createHttpsDevServerHelper(context: ConfigurationContext) {
  const { command, mode, config } = context;

  // This function can be provided to consumers
  return async () => {
    if (command === 'serve' && mode !== 'test') {
      const hosts = ['localhost'];
      const hasCertificates = devcert.hasCertificateFor(hosts);

      if (!hasCertificates) {
        log.info(log.prefix('useHttpsDevServer'), `Generating certificates with ${log.chalk.bold('devcert')}.`);
      }

      const { key, cert } = await devcert.certificateFor(hosts);

      config.server.https = { key, cert };
    } else {
      log.verbose(log.prefix('useHttpsDevServer'), 'No-op; Vite is not in dev server mode.');
    }
  };
}
