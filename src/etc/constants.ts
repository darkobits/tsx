/**
 * Compiles to `import.meta.env` at runtime. Hacky way of preventing Vite from
 * rewriting this value when used directly in our source.
 *
 * If we don't do this, our output will look something like:
 *
 * config.define["({}).SOME_ENV_VAR"] = 'some value';
 */
export const IMPORT_META_ENV = ['import', 'meta', 'env'].join('.');
