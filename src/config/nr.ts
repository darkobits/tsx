import { defineConfig } from '@darkobits/nr'
import { defaultPackageScripts } from '@darkobits/ts'

export default defineConfig([
  // Register all scripts provided by `@darkobits/ts`.
  defaultPackageScripts,
  // Overwrite the default 'start' script to instead run `vite serve`.
  ({ script, command }) => {
    script('start', command('vite', { args: ['serve'] }), {
      group: 'Lifecycle',
      description: 'Start the Vite dev server.'
    })
  }
])