import fs from 'fs/promises';
import path from 'path';

import { nr } from '@darkobits/ts';
import { getSourceAndOutputDirectories } from '@darkobits/ts';

export default nr(async ({ script, task, command }) => {
  const { srcDir, outDir } = await getSourceAndOutputDirectories();

  if (!srcDir) {
    throw new Error('[tsx] Unable to create commands; tsconfig.json does not define compilerOptions.baseUrl');
  }

  if (!outDir) {
    throw new Error('[tsx] Unable to create commands; tsconfig.json does not define compilerOptions.outDir');
  }

  script('postBuild', {
    group: 'Build',
    description: 'Perform post-build tasks.',
    run: [
      // Copies config/tsconfig-base.json from the source directory to the
      // output directory. This was previously handled by Babel's copyFiles
      // flag, but is unsupported by the TypeScript compiler.
      task('copy-tsconfig-base', async () => {
        await fs.copyFile(
          path.resolve(srcDir, 'config', 'tsconfig-base.json'),
          path.resolve(outDir, 'config', 'tsconfig-base.json')
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
