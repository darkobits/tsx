import defineConfig from '@darkobits/nr';
import { defaultPackageScripts } from '@darkobits/ts';


export default defineConfig([
  // Register all scripts provided by `@darkobits/ts`.
  defaultPackageScripts,
  ({ command, script }) => {
    // Define a 'start' script for consumers of this package who use `nr`.
    script('start', command('vite', { args: ['serve'] }), {
      group: 'Lifecycle',
      description: 'Start a Vite dev server.'
    });
  }
]);
