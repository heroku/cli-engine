// @flow

import Command from './update'
import Updater from '../updater'
import PluginsUpdate from './plugins/update'

describe.skip('Update command', async () => {
  describe('running', async () => {
    test('it submits the analytics', async () => {
      let cmd = await Command.run([], { mock: true })
    })
  })
})
