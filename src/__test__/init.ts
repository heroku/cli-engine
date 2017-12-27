import { cli } from 'cli-ux'
import * as nock from 'nock'

process.setMaxListeners(0)

let g: any = global
g.columns = 80
g.testing = true
nock.disableNetConnect()

beforeEach(() => {
  cli.config.mock = true
})
