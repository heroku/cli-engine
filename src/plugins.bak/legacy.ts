import {IFlag, InputFlags} from 'cli-flags'
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

export function convertFlagsFromV5 (legacy: LegacyFlag[] | InputFlags | undefined): InputFlags {
  if (!legacy) return {}
  if (!Array.isArray(legacy)) return legacy
  return legacy.reduce((flags, legacy: LegacyFlag) => {
    let opts = {
      char: legacy.char as any,
      description: legacy.description,
      hidden: legacy.hidden,
      required: legacy.required,
      optional: legacy.optional,
    }
    let flag: IFlag<any>
    if (legacy.hasValue) {
      flag = Flags.string({...opts, parse: legacy.parse})
    } else {
      flag = Flags.boolean(opts)
    }
    flags[legacy.name] = flag
    return flags
  }, {} as InputFlags)
}
