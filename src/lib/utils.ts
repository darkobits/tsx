import os from 'os';

import chex from '@darkobits/chex';
import devcert from 'devcert';

import log from 'lib/log';

import type { ConfigurationContext } from '@darkobits/ts/etc/types';
import type {
  ManualChunksFn,
  ManualChunkSpec,
  VendorOnlyChunkSpec
} from 'etc/types';


/**
 * Returns an array of all local IP addresses for the host machine.
 */
export function getLocalIpAddresses() {
  return Object.values(os.networkInterfaces()).flatMap(interfaces => {
    return interfaces?.map(i => (i.family === 'IPv4' ? i.address : false)).filter(Boolean);
  }) as Array<string>;
}


/**
 * Returns a short description of the current Git commit using 'git describe'.
 *
 * Example: "v0.12.7-17-9d2f0dc"
 */
export async function gitDescribe() {
  const git = await chex('git');
  const result = await git(['describe', '--tags', '--always']);

  const parsed = result.stdout
    // Remove the 'g' that immediately precedes the commit SHA.
    .replace(/-g(\w{7,})$/g, '-$1')
    // Replace the 'commits since last tag' segment with a dash.
    .replace(/-\d+-/g, '-');

  log.verbose(log.prefix('gitDescribe'), `Current Git description: ${log.chalk.green(result)}`);
  return parsed;
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
export function createManualChunksHelper(context: ConfigurationContext): ManualChunksFn {
  const { config } = context;

  // N.B. This is the function that users will invoke in their configuration.
  return (chunks: Array<ManualChunkSpec>) => {
    // N.B. This is the function that Vite will internally invoke to determine
    // what chunk a module should be sorted into.
    config.build.rollupOptions = config.build.rollupOptions ?? {};
    config.build.rollupOptions.output = config.build.rollupOptions.output ?? {};

    // @ts-expect-error - Unknown property manualChunks.
    config.build.rollupOptions.output.manualChunks = (rawId: string) => {
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
    };
  };
}


/**
 * Provided a Vite ConfigurationContext, determines if we are in development
 * mode and, if so, configures the development server to use HTTPS. Uses the
 * devcert package to generate self-signed certificates.
 */
export function createHttpsDevServerHelper(context: ConfigurationContext) {
  const { command, mode, config } = context;

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
