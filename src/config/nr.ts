import { nr } from '@darkobits/ts';

import type { UserConfigurationFn } from '@darkobits/nr';


export default (userConfigFactory?: UserConfigurationFn) => nr(async context => {
  const { script, command } = context;

  // Define a 'start' script for consumers of this package who use `nr`.
  script('start', command('vite', { args: ['serve'] }), {
    group: 'Lifecycle',
    description: 'Start a Vite dev server.'
  });

  if (typeof userConfigFactory === 'function') await userConfigFactory(context);
});
