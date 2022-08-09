import { nr } from '@darkobits/ts';
import { OUT_DIR } from '@darkobits/ts/etc/constants';

import type { ConfigurationFactory } from '@darkobits/nr/dist/etc/types';

export default function(userConfigFactory?: ConfigurationFactory): ConfigurationFactory {
  return nr(async ({ command, script, task, isCI }) => {
    command('rm-out-dir', ['del', [OUT_DIR]]);

    command.babel('vite-build', ['vite', ['build']]);

    command.babel('vite-watch', ['vite', ['build'], {watch: true }]);

    command.babel('vite-serve', ['vite', ['serve']]);

    script('build', {
      group: 'Vite',
      description: 'Compile the project with Vite.',
      run: [
        'cmd:rm-out-dir',
        'cmd:vite-build'
      ]
    });

    script('build.watch', {
      group: 'Vite',
      description: 'Continuously compile the project with Vite.',
      run: [
        'cmd:rm-out-dir',
        'cmd:vite-watch'
      ]
    });

    script('start', {
      group: 'Vite',
      description: 'Start the Vite dev server.',
      run: [
        'cmd:vite-serve'
      ]
    });

    // Note: We need to re-define the 'prepare' script from `ts` here because
    // instructions are resolved at script creation rather than at execution, so
    // the "build" script that `ts` resolves to will be its own, not ours.
    script('prepare', {
      group: 'Lifecycle',
      description: 'Run after "npm install" to ensure the project builds correctly and tests are passing.',
      run: isCI ? [] : [
        'script:build',
        'script:test',
        'cmd:update-notifier'
      ]
    });

    if (typeof userConfigFactory === 'function') {
      await userConfigFactory({
        command,
        script,
        task,
        isCI
      });
    }
  });
}
