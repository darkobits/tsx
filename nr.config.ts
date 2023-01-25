import path from 'path';

import { nr } from '@darkobits/ts';
import { SRC_DIR, OUT_DIR } from '@darkobits/ts/etc/constants';
import fs from 'fs-extra';

export default nr(({ script, task, command }) => {
  script('postBuild', {
    group: 'Build',
    description: 'Perform post-build tasks.',
    run: [
      // Copies config/tsconfig-base.json from the source directory to the
      // output directory. This was previously handled by Babel's copyFiles
      // flag, but is unsupported by the TypeScript compiler.
      task('copy-tsconfig-base', () => {
        fs.copyFile(
          path.resolve(SRC_DIR, 'config', 'tsconfig-base.json'),
          path.resolve(OUT_DIR, 'config', 'tsconfig-base.json')
        )
      }),
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
