// @flow

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
