import deps from './deps'
import { Stats } from 'fs'
import * as fs from 'fs-extra'
import * as klaw from 'klaw'

const debug = require('debug')('cli:file')

export function exists(f: string): Promise<boolean> {
  // debug('exists', f)
  // @ts-ignore
  return fs.exists(f)
}

const jsonFiles: { [k: string]: Promise<any> } = {}
export function fetchJSONFile(f: string): Promise<any> {
  if (!jsonFiles[f]) {
    debug('fetchJSONFile', f)
    jsonFiles[f] = fs.readJSON(f)
  }
  return jsonFiles[f]
}

export async function rename(from: string, to: string): Promise<void> {
  debug('rename', from, to)
  return fs.rename(from, to)
}

export async function mkdirp(dir: string): Promise<void> {
  debug('mkdirp', dir)
  return fs.mkdirp(dir)
}

export async function outputFile(file: string, data: any, options?: fs.WriteFileOptions | string): Promise<void> {
  debug('outputFile', file)
  return fs.outputFile(file, data, options)
}

export async function outputJSON(file: string, data: any, options: fs.WriteOptions = {}) {
  debug('outputJSON', file)
  return fs.outputJSON(file, data, { spaces: 2, ...options })
}

export async function readJSON(file: string) {
  debug('readJSON', file)
  return fs.readJSON(file)
}

export async function read(file: string) {
  debug('read', file)
  return fs.readFile(file, 'utf8')
}

export async function remove(file: string) {
  debug('remove', file)
  return fs.remove(file)
}

export async function stat(file: string): Promise<Stats> {
  debug('stat', file)
  return fs.stat(file)
}

export function open(path: string | Buffer, flags: string | number, mode?: number): Promise<number> {
  debug('open', path, flags, mode)
  return fs.open(path, flags, mode)
}

export function write(fd: number, data: any): Promise<Stats> {
  debug('write', fd)
  // @ts-ignore
  return fs.write(fd, data)
}

export function walk(root: string, opts: klaw.Options = {}): Promise<klaw.Item[]> {
  debug('walk', root)
  return new Promise((resolve, reject) => {
    const items: klaw.Item[] = []
    deps
      .klaw(root, {
        ...opts,
        depthLimit: 10000,
      })
      .on('data', f => items.push(f))
      .on('error', reject)
      .on('end', () => resolve(items))
  })
}
