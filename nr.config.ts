import fs from 'fs/promises';
import path from 'path';

import { withDefaultPackageScripts } from '@darkobits/ts';


export default withDefaultPackageScripts(({ script, command, task }) => {
  // When publishing this package, we use re-pack's 'publish' command to publish
  // from the .re-pack folder rather than `npm publish`.
  script('publish', [
    // Re-pack the project.
    command('re-pack'),
    // Publish the project from the re-pack directory.
    command('re-pack', {
      args: ['publish']
    }),
    // Push the release commit.
    command('git', {
      args: ['push', 'origin', 'HEAD', { setUpstream: true, followTags: true }]
    }),
    // Remove the re-pack directory.
    task(() => fs.rm(path.resolve('.re-pack'), { recursive: true, force: true }))
  ], {
    group: 'Release',
    description: 'Publish the package using re-pack.'
  });

  script('postBump', [
    'script:publish',
    command('git', {
      args: ['push', 'origin', 'HEAD', { followTags: true, setUpstream: true }]
    })
  ], {
    group: 'Lifecycles',
    description: 'Publishes the project and pushes the release commit.'
  });
});
