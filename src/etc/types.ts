import type { ConfigurationContext } from '@darkobits/ts/etc/types';
import type bytes from 'bytes';
import type ms from 'ms';
import type { PluginOption } from 'vite';

/**
 * Context object used for the React configuration preset.
 */
export interface ReactPresetContext extends ConfigurationContext {
  /**
   * Utility to parse a human readable string (ex: '512kb') to bytes (524288)
   * and vice-versa. Useful for specifying configuration options that expect
   * a number in bytes.
   *
   * See: https://github.com/visionmedia/bytes.js
   */
  bytes: typeof bytes;

  /**
   * Utility for converting a human readable string (ex: '2h') to milliseconds
   * (7200000). Useful for specifying configuration options that expect an
   * amount of time in milliseconds.
   *
   * See: https://github.com/vercel/ms
   */
  ms: typeof ms;

  /**
   * Utility for looking-up and reconfiguring a plugin that has already been
   * added to a Vite configuration object.
   *
   * Provided a plugin name and a configuration object, merges the provided
   * configuration with the plugin's existing configuration.
   */
  reconfigurePlugin: (newPlugin: PluginOption) => Promise<void>;

  /**
   * Helper that can be used to facilitate code-splitting. Accepts an array of
   * chunk specs and assigns a function to
   * `build.rollupOptions.output.manualChunks` that will sort modules into the
   * first matching chunk spec.
   *
   * @example
   *
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
   */
  manualChunks: ManualChunksFn;

  /**
   * Helper that can be used to configure the Vite development server to use
   * HTTPS. Uses `devcert` to automatically generate self-signed certificates.
   *
   * See: https://github.com/davewasmer/devcert
   */
  useHttpsDevServer: () => Promise<void>;
}

// ----- Manual Chunks Builder -------------------------------------------------

export interface ExplicitChunkSpec {
  /**
   * Name to use for this chunk.
   */
  name: string;

  /**
   * If `true`, will additionally ensure that any modules included in this chunk
   * are from `node_modules`. When using this option, you may omit checks for
   * `node_modules` in `include` patterns.
   */
  vendor?: boolean;

  /**
   * List of strings or regular expressions to match against to determine if a
   * module should be included in this chunk.
   */
  include: Array<string | RegExp>;
}

/**
 * Shorthand chunk spec that will include any module from the `node_modules`
 * directory.
 */
export interface VendorOnlyChunkSpec {
  /**
   * Name to use for this chunk.
   */
  name: string;

  /**
   * Any module from `node_modules` will be included in this chunk.
   */
  vendor: true;
}

/**
 * The value provided to `manualChunks` may be either spec type.
 */
export type ManualChunkSpec = ExplicitChunkSpec | VendorOnlyChunkSpec;

/**
 * Signature of manual chunks.
 */
export type ManualChunksFn = (chunks: Array<ManualChunkSpec>) => void;
