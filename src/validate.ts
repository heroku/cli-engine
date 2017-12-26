import cli from 'cli-ux'
import { inspect } from 'util'

function validate(type: string) {
  return (o: any, filename: string) => {
    let validate = require('cli-engine-config/lib/schema')
    if (validate({ [type]: o }, filename)) return
    const errors = validate.errors
      .map((v: any) => `${v.dataPath}: ${v.message}${v.params ? ': ' + inspect(v.params) : ''}`)
      .join('\n')
    cli.warn(new Error(`Error reading ${filename}:\n${errors}`))
  }
}

export const cliPjson = validate('cliPjson')
export const pluginPjson = validate('pluginPjson')
export const command = validate('command')
