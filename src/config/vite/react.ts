import { EXTENSIONS } from '@darkobits/ts/etc/constants';
import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin';
import reactPlugin from '@vitejs/plugin-react';
// eslint-disable-next-line import/default
import checkerPlugin from 'vite-plugin-checker';
import svgrPlugin from 'vite-plugin-svgr';
import tsconfigPathsPlugin from 'vite-tsconfig-paths';

import { gitDescribe } from 'lib/utils';
import { createViteConfigurationPreset, getViteRoot } from 'lib/vite';


// ----- React Configuration ---------------------------------------------------

export default createViteConfigurationPreset(async ({ config, isDevServer, isProduction, mode }) => {
  // ----- Input / Output ------------------------------------------------------

  // Creates bundles for each production dependency by name and version. Assets
  // and application code are named using hashes.
  if (isProduction) {
    config.build.rollupOptions.output = {
      entryFileNames: '[name]-[hash].js',
      assetFileNames: 'assets/[name]-[hash][extname]',
      chunkFileNames: '[name]-[hash].js',
      manualChunks: rawId => {
        const id = rawId.replace(/\0/g, '');
        if (id.includes('node_modules')) return 'vendor';
      }
    };
  }

  // Enable source maps.
  config.build.sourcemap = true;


  // ----- Environment ---------------------------------------------------------

  config.define = {
    'import.meta.env.GIT_DESC': JSON.stringify(await gitDescribe()),
    'import.meta.env.NODE_ENV': JSON.stringify(mode)
  };


  // ----- Plugins -------------------------------------------------------------

  config.plugins.push(reactPlugin());

  // Enable fast TypeScript and ESLint support using separate worker threads.
  config.plugins.push(checkerPlugin({
    typescript: true,
    eslint: {
      lintCommand: `eslint ${config.root} --ext=${EXTENSIONS.join(',')}`
    }
  }));

  // Add support for vanilla-extract.
  // See: https://vanilla-extract.style
  config.plugins.push(vanillaExtractPlugin());

  // Add support for TypeScript path mappings.
  // See: https://github.com/aleclarson/vite-tsconfig-paths
  config.plugins.push(tsconfigPathsPlugin({
    // Note: This does assume that the user's Vite configuration file and
    // tsconfig.json are in the same directory.
    projects: [await getViteRoot()]
  }));

  // Import SVG assets as React components.
  // See: https://github.com/pd4d10/vite-plugin-svgr
  config.plugins.push(svgrPlugin({
    svgrOptions: {
      // Replace SVG `width` and `height` value by `1em` in order to make SVG
      // size inherit from text size.
      icon: true,
      // Memoize components.
      memo: true
    }
  }));


  // ----- Development Server --------------------------------------------------

  if (isDevServer) {
    // Bind to all available local hosts.
    config.server.host = true;
  }


  // ----- Testing -------------------------------------------------------------

  // Set Vitest's environment to 'jsdom' for testing React components.
  config.test = {
    environment: 'jsdom'
  };


  // ----- Hacks ---------------------------------------------------------------

  /**
   * See: https://github.com/vitejs/vite/discussions/5079#discussioncomment-1890839
   */
  if (isProduction) {
    config.css = {
      postcss: {
        plugins: [{
          postcssPlugin: 'internal:charset-removal',
          AtRule: {
            charset: atRule => {
              if (atRule.name === 'charset') atRule.remove();
            }
          }
        }]
      }
    };

    // TODO: The above hack may be remedied by this simpler solution.
    // See: https://github.com/vitejs/vite/discussions/5079#discussioncomment-1690405
    // config.css = {
    //   preprocessorOptions: {
    //     css: {
    //       charset: false
    //     }
    //   }
    // };
  }
});
