import { nr } from '@darkobits/ts';

import type { ConfigurationFactory } from '@darkobits/nr';


export default (userConfigFactory?: ConfigurationFactory) => nr(async context => {
  const { command, script } = context;

  // Define a "start" script for consumers of this package who use "nr".
  script('start', {
    group: 'Lifecycle',
    description: 'Start the Vite dev server.',
    run: [
      command('vite-serve', ['vite', ['serve']])
    ]
  });

  if (typeof userConfigFactory === 'function') {
    await userConfigFactory(context);
  }
});
