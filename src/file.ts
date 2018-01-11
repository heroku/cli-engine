import { Stats } from 'fs'
import * as fs from 'fs-extra'
import * as klaw from 'klaw'
import * as path from 'path'

import deps from './deps'

const debug = require('debug')('cli:file')

export function exists(f: string): Promise<boolean> {
  // debug('exists', f)
  // @ts-ignore
  return fs.exists(f)
}

export function existsSync(f: string): boolean {
  return fs.existsSync(f)
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

export function outputFileSync(p: string, body: string) {
  debug('outputFileSync')
  return fs.outputFileSync(p, body)
}

export async function outputJSON(file: string, data: any, options: fs.WriteOptions = {}) {
  debug('outputJSON', file)
  return fs.outputJSON(file, data, { spaces: 2, ...options })
}

export async function readJSON(file: string) {
  debug('readJSON', file)
  return fs.readJSON(file)
}

export async function readFile(file: string) {
  debug('read', file)
  return fs.readFile(file, 'utf8')
}

export async function remove(file: string) {
  if (!await exists(file)) return
  debug('remove', file)
  return fs.remove(file)
}

export async function stat(file: string): Promise<Stats> {
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

export async function ls(dir: string) {
  let files = await fs.readdir(dir)
  let paths = files.map(f => path.join(dir, f))
  return Promise.all(paths.map(path => fs.stat(path).then(stat => ({ path, stat }))))
}

export async function cleanup(dir: string): Promise<void> {
  let files
  try {
    files = await ls(dir)
  } catch (err) {
    if (err.code === 'ENOENT') return
    throw err
  }
  let dirs = files.filter(f => f.stat.isDirectory()).map(f => f.path)
  for (let p of dirs.map(cleanup)) await p
  files = await ls(dir)
  if (!files.length) await remove(dir)
}

export function symlink(src: string, dst: string): Promise<void> {
  return fs.symlink(src, dst)
}

export function utimesSync(p: string, atime: Date, mtime: Date) {
  debug('utimeSync')
  return fs.utimesSync(p, atime, mtime)
}

export function touch(p: string) {
  debug('touch', p)
  try {
    return fs.utimes(p, new Date(), new Date())
  } catch (err){
    return outputFile(p, '')
  }
}

export function mkdirpSync(p: string) {
  debug('mkdirpSync', p)
  return fs.mkdirpSync(p)
}

export function emptyDir(p: string) {
  debug('emptyDir', p)
  return fs.emptyDir(p)
}
