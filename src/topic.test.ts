import { ICommandInfo } from './command'
import Version from './commands/version'
import { Plugin } from './plugins/plugin'
import { RootTopic } from './topic'

test('it adds topics', () => {
  let root = new RootTopic()

  root.addTopics([
    { description: 'bar:baz:bak:fo desc', name: 'bar:baz:bak:fo' },
    { description: 'basic', name: 'basic' },
    { description: 'foo desc', name: 'foo' },
    { description: 'foo:bar desc', name: 'foo:bar' },
    { description: 'foo:bar:baz:bak desc', name: 'foo:bar:baz:bak' },
    { description: 'foo:fee:fie:fo desc', name: 'foo:fee:fie:fo' },
  ])

  expect(root.findTopic('basic')).toMatchObject({
    description: 'basic',
    name: 'basic',
  })
  expect(root.findTopic('foo:bar:baz:bak')).toMatchObject({
    description: 'foo:bar:baz:bak desc',
    name: 'foo:bar:baz:bak',
  })
})

test('it adds commands', () => {
  const root = new RootTopic()

  const basecmd: ICommandInfo = {
    help: 'str',
    description: 'lkj',
    usage: 'lkj',
    helpLine: ['foo', 'bar'],
    hidden: false,
    id: 'foo:bar:baz:bak',
    fetchCommand: async () => Version,
    run: async () => {},
    aliases: [],
    plugin: {} as Plugin,
  }
  root.addCommands([
    { ...basecmd, id: 'foo:bar:baz:bak', help: 'foo help' },
    { ...basecmd, id: 'status', help: 'status help' },
  ])

  expect(root.findTopic('foo:bar:baz')!.commands.bak).toHaveProperty('help', 'foo help')
  expect(root.findCommand('foo:bar:baz:bak')).toHaveProperty('help', 'foo help')
  expect(root.findCommand('status')).toHaveProperty('help', 'status help')
})

test('topic merging', () => {
  const root = new RootTopic()

  root.addTopics([
    { name: 'foo:bar:buz', description: 'overwritten desc' },
    { name: 'foo:bar', subtopics: { buz: { description: 'buz desc' } } },
  ])

  expect(root.findTopic('foo:bar:buz')).toHaveProperty('description', 'buz desc')
})
