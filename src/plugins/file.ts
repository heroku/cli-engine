import * as fs from 'fs-extra'
import RWLockfile, { rwlockfile } from 'rwlockfile'
import _ from 'ts-lodash'

import { VERSION as _version } from '../cli'
import deps from '../deps'

interface Body {
  [k: string]: any
}

export default abstract class PluginFile {
  protected lock: RWLockfile
  protected debug: any

  constructor(public type: string, public file: string) {
    this.debug = require('debug')(`cli:${this.type}`)
    this.lock = new RWLockfile(this.file)
  }

  @rwlockfile('lock', 'write')
  async reset() {
    this.debug('reset', this.file)
    await deps.file.remove(this.file)
  }

  protected async get<T>(key: string): Promise<T | undefined>
  protected async get<T,U>(key: string, secondKey: string): Promise<[T | undefined,U | undefined]>
  @rwlockfile('lock', 'read')
  protected async get(key: string, secondKey?: string): Promise<any> {
    this.debug('get', _.compact([key, secondKey]))
    const body = await this.read()
    return secondKey ? [body[key], body[secondKey]] : body[key]
  }

  @rwlockfile('lock', 'write')
  protected async set(...pairs: [string, any][]) {
    const body = await this.read()
    for (let [k, v] of pairs) {
      this.debug('set', k)
      body[k] = v
    }
    await this.write(body)
  }

  private async read(): Promise<Body> {
    const read = async () => {
      try {
        return await fs.readJSON(this.file)
      } catch (err) {
        if (err.code === 'ENOENT') this.debug('manifest not found', this.file)
        else {
          await deps.file.remove(this.file)
          throw err
        }
      }
    }
    const body = (await read()) || {_version}
    if (!body._version) return {_version}
    return body
  }

  private async write(body: Body): Promise<void> {
    this.debug('write', this.file)
    await deps.file.outputJSON(this.file, body)
  }
}
