module.exports = {
  extends: require('@darkobits/ts').babel,
  presets: [
    ['@babel/preset-env', {
      useBuiltIns: 'entry',
      corejs: 3,
      // Do not transpile import() statements. This will allow packages that
      // publish CommonJS to import ES Modules.
      exclude: ['@babel/plugin-proposal-dynamic-import']
    }],
    '@babel/preset-typescript',
    '@babel/preset-react'
  ],
  plugins: [
    // Note: Disabling this may help with Vite issues regarding import.meta.env.
    // 'babel-plugin-transform-import-meta',
    '@babel/plugin-transform-runtime',
    ['@babel/plugin-proposal-decorators', { legacy: true, loose: true }],
    // TODO: Re-evaluate using this now that we no longer use Linaria.
    ['babel-plugin-module-resolver', {
      cwd: 'babelrc',
      root: ['./src'],
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.cjs', '.mjs', '.json']
    }]
  ],
  comments: false,
  sourceType: 'unambiguous'
};
