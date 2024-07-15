/**
 * Compiles to `import.meta.env` at _runtime_, preventing Vite from resolving
 * this value when this project is built. If we don't do this, our output will
 * look something like:
 *
 * config.define["({}).SOME_ENV_VAR"] = 'some value';
 */
export const IMPORT_META_ENV = ['import', 'meta', 'env'].join('.');
