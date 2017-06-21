// @flow

import path from 'path'

export default class {
  static autocompletePath (datadir: string): string {
    return path.join(datadir, 'client', 'node_modules', 'cli-engine', 'autocomplete')
  }
}
