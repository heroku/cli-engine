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

export async function outputFile(file: string, data: any, options: any) {
  debug('outputFile', file)
  return fs.outputFile(file, data, options)
}

export async function outputJSON(file: string, data: any, options: any) {
  debug('outputJSON', file)
  return fs.outputJSON(file, data, options)
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
