import * as fs from 'fs-extra'

const debug = require('debug')('cli:file')

export function exists(f: string): Promise<boolean> {
  debug('exists', f)
  // @ts-ignore
  return fs.exists(f)
}

const jsonFiles: { [k: string]: any } = {}
export async function fetchJSONFile(f: string): Promise<any> {
  if (!jsonFiles[f]) {
    debug('fetchJSONFile', f)
    jsonFiles[f] = await fs.readJSON(f)
  }
  return jsonFiles[f]
}

export async function outputFile(file: string, data: any, options: any) {
  debug('outputFile', file, data, options)
  return fs.outputFile(file, data, options)
}

export async function outputJSON(file: string, data: any, options: any) {
  debug('outputJSON', file, data, options)
  return fs.outputJSON(file, data, options)
}
