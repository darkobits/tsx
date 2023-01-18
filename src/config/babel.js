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
  // Note: We should not include `babel-plugin-transform-import-meta` here as
  // it will interfere with the use of `import.meta.env` and Vite.
  plugins: [
    '@babel/plugin-transform-runtime',
    ['@babel/plugin-proposal-decorators', { legacy: true, loose: true }]
  ],
  comments: false,
  sourceType: 'unambiguous'
};
