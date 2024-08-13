import path from 'node:path'

import type { RePackConfiguration } from '@darkobits/re-pack'

export default {
  afterRepack: ({ fs, packDir }) => {
    // Moves config/tsconfig-base.json to tsconfig.json in the re-packed package
    // root. This allows consumers to extend "@darkobits/tsx/tsconfig.json" in
    // their tsconfig files.
    fs.moveSync(
      path.resolve(packDir, 'config', 'tsconfig-base.json'),
      path.resolve(packDir, 'tsconfig.json')
    )
  }
} satisfies RePackConfiguration