// @flow

import Commands from './commands'

test('outputs commands', async () => {
  const cmd = await Commands.mock()
  let {commands, topics} = JSON.parse(cmd.out.stdout.output)
  expect(topics.find(t => t.topic === 'plugins')).toMatchObject({
    description: 'manage plugins'
  })
  expect(commands.find(t => t.topic === 'plugins' && t.command === 'install')).toMatchObject({
    description: 'installs a plugin into the CLI'
  })
})
