import { nr } from '@darkobits/ts';
import { OUT_DIR } from '@darkobits/ts/etc/constants';

import log from 'lib/log';

import type { ConfigurationFactory } from '@darkobits/nr/dist/etc/types';


export default (userConfigFactory?: ConfigurationFactory): ConfigurationFactory => nr(async ctx => {
  const { command, script, task, isCI } = ctx;


  // ----- Build Scripts -------------------------------------------------------

  const rmOutDir = command('rm-out-dir', ['del', [OUT_DIR]]);

  // N.B. With the exception of 'start', these overwrite scripts implemented in
  // `ts`.

  const buildScript = script('build', {
    group: 'Vite',
    description: 'Compile the project with Vite.',
    run: [
      rmOutDir,
      command.babel('vite-build', ['vite', ['build']])
    ]
  });

  script('build.watch', {
    group: 'Vite',
    description: 'Continuously compile the project with Vite.',
    run: [
      rmOutDir,
      command.babel('vite-watch', ['vite', ['build'], {watch: true }])
    ]
  });

  script('start', {
    group: 'Vite',
    description: 'Start the Vite dev server.',
    run: [
      command.babel('vite-serve', ['vite', ['serve']])
    ]
  });


  // ----- Lifecycle Scripts ---------------------------------------------------

  const updateNotifier = command.babel('update-notifier', [require.resolve('etc/scripts/update-notifier')]);

  // Note: We need to re-define the 'prepare' script from `ts` here because
  // instructions are resolved at script creation rather than at execution.
  script('prepare', {
    group: 'Lifecycle',
    description: 'Run after "npm install" to ensure the project builds correctly and tests are passing.',
    run: isCI ? [
      // Don't run our prepare script in CI environments, giving consumers
      // the granularity to build and/or test their project in discreet steps.
      task('skip-prepare', () => {
        log.verbose(log.prefix('prepare'), [
          'CI environment detected.',
          `Skipping ${log.chalk.bold.green('prepare')} script.`
        ].join(' '));
      })
    ] : [
      buildScript,
      // N.B. This comes from `ts`.
      'script:test',
      updateNotifier
    ]
  });


  if (typeof userConfigFactory === 'function') {
    await userConfigFactory(ctx);
  }
});
