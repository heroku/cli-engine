// @flow

import type {Flag} from 'cli-engine-config'
import {flags as Flags} from 'cli-engine-command'

export type LegacyFlag = {
  name: string,
  description?: string,
  char?: string,
  hasValue?: boolean,
  hidden?: boolean,
  required?: boolean,
  optional?: boolean,
  parse?: any
}

export function convertFlagsFromV5 (flags: ?(LegacyFlag[] | {[name: string]: Flag})): {[name: string]: any} {
  if (!flags) return {}
  if (!Array.isArray(flags)) return flags
  return flags.reduce((flags, flag) => {
    let opts: Flag = {
      char: (flag.char: any),
      description: flag.description,
      hidden: flag.hidden,
      required: flag.required,
      optional: flag.optional,
      parse: flag.parse
    }
    Object.keys(opts).forEach(k => opts[k] === undefined && delete opts[k])
    flags[flag.name] = flag.hasValue ? Flags.string(opts) : Flags.boolean((opts: any))
    return flags
  }, {})
}
