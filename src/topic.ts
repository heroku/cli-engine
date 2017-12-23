import {ICommandInfo} from './command'

export interface INestedTopic {
  description?: string
  subtopics?: {[k: string]: INestedTopic}
  commands?: {[k: string]: ICommandInfo}
  hidden?: boolean
}

export interface ITopic extends INestedTopic {
  name: string
}

function topicOf (id: string): string {
  return id.split(':').slice(0, -1).join(':')
}

function keyOf (id: string): string {
  return id.split(':').slice(-1).join(':')
}

export class TopicBase {
  public subtopics: {[k: string]: Topic} = {}
  public commands: {[k: string]: ICommandInfo} = {}

  public findTopic(id: string): Topic | undefined {
    let key = keyOf(id)
    let parentID = topicOf(id)
    if (parentID) {
      let parent = this.findTopic(parentID)
      return parent && parent.subtopics[key]
    }
    return this.subtopics[key]
  }

  public findCommand(id: string): ICommandInfo | undefined {
    const topic = this.findTopic(topicOf(id))
    if (topic) return topic.findCommand(id)
    return this.commands[keyOf(id)]
  }
}

export class Topic extends TopicBase implements ITopic {
  public name: string
  public description?: string
  public hidden: boolean

  constructor(opts: ITopic) {
    super()
    this.name = opts.name
    this.description = opts.description
    this.hidden = !!opts.hidden
    this.commands = opts.commands || {}
  }

}

function topicsToArray (input: ITopic[] | {[k: string]: ITopic} | undefined): ITopic[]
function topicsToArray (input: {[k: string]: INestedTopic} | undefined, base: string): ITopic[]
function topicsToArray (input: ITopic[] | {[k: string]: ITopic | INestedTopic} | undefined, base?: string): ITopic[] {
  if (Array.isArray(input)) return input
  base = base ? `${base}:` : ''
  return Object
    .entries(input || {})
    .map(([k,v]) => new Topic({ ...v, name: `${base}${k}` }))
}

export class RootTopic extends TopicBase {
  public subtopics: {[k: string]: Topic} = {}
  public commands: {[k: string]: ICommandInfo} = {}

  public addTopics (topics: ITopic[] | {[k: string]: ITopic} | undefined) {
    for (let t of topicsToArray(topics)) {
      let topic = this.findOrCreateTopic(t.name)
      this.mergeTopics(topic, t)
      this.addTopics(topicsToArray(t.subtopics, t.name))
      this.addCommands(t.commands)
    }
  }

  public addCommands (commands: ICommandInfo[] | {[k: string]: ICommandInfo} | undefined) {
    for (let c of Object.values(commands || {})) {
      let topicID = topicOf(c.id)
      let topic = topicID ? this.findOrCreateTopic(topicID) : this
      topic.commands[keyOf(c.id)] = c
    }
  }

  private findOrCreateTopic (name: string): Topic {
    let key = keyOf(name)
    let parentID = topicOf(name)
    let topics = this.subtopics
    if (parentID) {
      let parent = this.findOrCreateTopic(parentID)
      topics = parent.subtopics
    }
    return topics[key] = topics[key] || new Topic({name})
  }

  private mergeTopics (a: Topic, b: ITopic) {
    a.description = b.description || a.description
    a.hidden = b.hidden || a.hidden
  }
}
