import { nr } from '@darkobits/ts';

import type { ConfigurationFactory } from '@darkobits/nr/dist/etc/types';


export default (userConfigFactory?: ConfigurationFactory) => nr(async context => {
  const { command, script } = context;

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
