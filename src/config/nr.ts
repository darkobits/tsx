import { nr, getSourceAndOutputDirectories } from '@darkobits/ts';

import log from 'lib/log';

import type { ConfigurationFactory } from '@darkobits/nr/dist/etc/types';


export default (userConfigFactory?: ConfigurationFactory): ConfigurationFactory => nr(async context => {
  const { command, script, task, isCI } = context;
  const { outDir } = await getSourceAndOutputDirectories();


  // ----- Build Scripts -------------------------------------------------------

  const rmOutDir = command('rm-out-dir', ['del', [outDir]]);

  // N.B. With the exception of 'start', these overwrite scripts implemented in
  // `ts`.

  const buildScript = script('build', {
    group: 'Vite',
    description: 'Compile the project with Vite.',
    run: [
      rmOutDir,
      command('vite-build', ['vite', ['build']])
    ]
  });

  script('build.watch', {
    group: 'Vite',
    description: 'Continuously compile the project with Vite.',
    run: [
      rmOutDir,
      command('vite-watch', ['vite', ['build'], {watch: true }])
    ]
  });

  script('start', {
    group: 'Vite',
    description: 'Start the Vite dev server.',
    run: [
      command('vite-serve', ['vite', ['serve']])
    ]
  });


  // ----- Lifecycle Scripts ---------------------------------------------------

  // Note: We need to re-define the 'prepare' script from `ts` here because
  // instructions are resolved at script creation rather than at execution.
  script('prepare', {
    group: 'Lifecycle',
    description: 'Run after "npm install" to ensure the project builds correctly and tests are passing.',
    run: isCI ? [
      // Don't run our prepare script in CI environments, giving consumers
      // the granularity to build and/or test their project in discreet steps.
      task('skip-prepare', () => {
        log.info(log.prefix('prepare'), [
          'CI environment detected.',
          `Skipping ${log.chalk.bold.green('prepare')} script.`
        ].join(' '));
      })
    ] : [
      buildScript,
      // N.B. This comes from `ts`.
      'script:test'
    ]
  });


  if (typeof userConfigFactory === 'function') {
    await userConfigFactory(context);
  }
});
