import { nr } from '@darkobits/ts';

import type { ConfigurationFactory } from '@darkobits/nr/dist/etc/types';


// N.B. This effectively re-exports all scripts defined in `ts` while still
// allowing `tsx` users to define additional scripts.
export default (userConfigFactory?: ConfigurationFactory) => nr(async context => {
  if (typeof userConfigFactory === 'function') {
    await userConfigFactory(context);
  }
});
