import { nr } from '@darkobits/ts';

export default nr(({ script, command }) => {
  // N.B. NR automatically runs this after the 'build' script is run.
  script('postbuild', {
    group: 'Build',
    description: 'Re-pack the project after building.',
    run: [
      command('re-pack', ['re-pack'])
    ]
  });

  script('publish', {
    group: 'Release',
    description: 'Publish the package using re-pack.',
    run: [
      command('re-pack', ['re-pack', ['publish']])
    ]
  });
});
