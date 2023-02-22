import fs from 'fs/promises';
import path from 'path';

import { nr } from '@darkobits/ts';


export default nr(({ script, command, task }) => {
  // When publishing this package, we use re-pack's 'publish' command to publish
  // from the .re-pack folder rather than `npm publish`.
  script('publish', {
    group: 'Release',
    description: 'Publish the package using re-pack.',
    run: [
      // Re-pack the project.
      command('re-pack', ['re-pack']),
      // Publish the project from the re-pack directory.
      command('re-pack-publish', ['re-pack', ['publish']]),
      // Push the release commit.
      command('git-push', ['git', ['push', 'origin', 'HEAD'], {
        setUpstream: true,
        followTags: true
      }]),
      // Remove the re-pack directory.
      task('rm-re-pack', () => fs.rm(path.resolve('.re-pack'), {
        recursive: true,
        force: true
      }))
    ]
  });

  script('postBump', {
    group: 'Lifecycles',
    description: 'Publishes the project and pushes the release commit.',
    run: [
      'script:publish',
      command('git-push', ['git', ['push', 'origin', 'HEAD'], {
        followTags: true,
        setUpstream: true
      }])
    ]
  });
});
