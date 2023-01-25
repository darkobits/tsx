import type bytes from 'bytes';
import type merge from 'deepmerge';
import type ms from 'ms';
import type { NormalizedPackageJson } from 'read-pkg-up';
import type { OutputOptions } from 'rollup';
import type { UserConfig, PluginOption } from 'vite';

type BaseBuildOptions = NonNullable<UserConfig['build']>;
type BaseBuildRollupOptions = NonNullable<BaseBuildOptions['rollupOptions']>;
type BaseBuildRollupPluginsOptions = NonNullable<BaseBuildRollupOptions['plugins']>;

export interface ViteBuildRollupOptions extends BaseBuildRollupOptions {
  output: OutputOptions;
  plugins: BaseBuildRollupPluginsOptions;
}

export interface ViteBuildConfiguration extends BaseBuildOptions {
  outDir: string;
  rollupOptions: ViteBuildRollupOptions;
}

export interface ViteConfiguration extends UserConfig {
  root: string;
  build: ViteBuildConfiguration;
  plugins: NonNullable<UserConfig['plugins']>;
  resolve: NonNullable<UserConfig['resolve']>;
  server: NonNullable<UserConfig['server']>;

  /**
   * Internal flag that, if true, will cause TSX to include
   * "vite-plugin-inspect" when starting the dev server.
   *
   * See: https://github.com/antfu/vite-plugin-inspect
   */
  inspect?: boolean;
}


/**
 * Object passed to 'tsx' Vite configuration factories.
 */
export interface ViteConfigurationFnContext {
  command: 'build' | 'serve';

  /**
   * Usually one of 'development' or 'production' unless explicitly overwritten.
   *
   * See: https://vitejs.dev/config/shared-options.html#mode
   */
  mode: string;

  /**
   * Normalized package.json and resolved root directory of the host project.
   */
  pkg: {
    json: NormalizedPackageJson;
    rootDir: string;
  };

  /**
   * Empty Vite configuration scaffold that the configuration factory may
   * modify and return.
   */
  config: ViteConfiguration;

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
   * Utility for recursively merging objects.
   */
  merge: typeof merge;

  /**
   * True if mode === 'production'.
   */
  isProduction: boolean;

  /**
   * True if mode === 'development';
   */
  isDevelopment: boolean;

  /**
   * True if the compilation was started with the `serve` command.
   */
  isDevServer: boolean;

  /**
   * Provides a declarative way to look-up and re-configure existing plugins.
   *
   * Provided a plugin name and a configuration object, merges the provided
   * configuration with the plugin's base configuration.
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
}


/**
 * Signature of a 'tsx' Vite configuration factory.
 */
export type ViteConfigurationFactory = (
  opts: ViteConfigurationFnContext
) => void | ViteConfiguration | Promise<void | ViteConfiguration>;


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
