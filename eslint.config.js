import { defineFlatConfig, presetTsx } from '@darkobits/eslint-config'

export default defineFlatConfig([
  ...presetTsx,
  {
    rules: {
      '@stylistic/max-statements-per-line': 'off'
    }
  }
])