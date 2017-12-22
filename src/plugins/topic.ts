export interface ICommands {
  [k: string]: ICommandInfo
}
export interface ICommandInfo {
  id: string
  hidden: boolean
  help: string
  helpLine: [string, string | undefined]
}

export interface ITopicOpts {
  name: string
  description?: string
  hidden?: boolean
  commands?: ICommands
  subtopics?: ITopics
}

export interface ITopics {
  [k: string]: Topic
}

export class Topic {
  static parentTopicIDof(id: string) {
    return id
      .split(':')
      .slice(0, -1)
      .join(':')
  }

  static findTopic(name: string, topics: ITopics): Topic | undefined {
    let id = name.split(':')
    name = id.pop()!
    if (id.length > 0) {
      let parent = Topic.findTopic(id.join(':'), topics)
      if (!parent) return
      topics = parent.subtopics
    }
    return topics[name]
  }

  static findOrCreateTopic(opts: ITopicOpts, topics: ITopics): Topic {
    let id = opts.name.split(':')
    opts.name = id.pop()!
    if (id.length > 0) {
      let parent = Topic.findOrCreateTopic({ name: id.join(':') }, topics)
      topics = parent.subtopics
    }
    if (!topics[opts.name]) {
      topics[opts.name] = new Topic(opts)
    } else {
      topics[opts.name] = Topic.mergeTopics(topics[opts.name], opts)
    }
    return topics[opts.name]
  }

  static mergeSubtopics(...subtopics: Array<ITopics | undefined>): ITopics {
    const topics: ITopics = {}
    for (let p of subtopics) {
      for (let t of Object.values(p || {})) {
        if (!(t as ITopicOpts).name) continue
        Topic.findOrCreateTopic(t as ITopicOpts, topics)
      }
    }
    return topics
  }

  static mergeTopics(a: ITopicOpts, b: ITopicOpts) {
    return new Topic({
      ...b,
      ...a,
      commands: {
        ...(b || {}).commands,
        ...(a || {}).commands,
      },
      subtopics: Topic.mergeSubtopics((a || {}).subtopics, (b || {}).subtopics),
    })
  }

  public name: string
  public description?: string
  public hidden: boolean
  public subtopics: ITopics
  public commands: ICommands

  constructor(opts: ITopicOpts) {
    if (opts.name.includes(':')) throw new Error(`${this.name} should not have ":" in it`)
    this.name = opts.name
    this.description = opts.description
    this.hidden = !!opts.hidden
    this.subtopics = opts.subtopics || {}
    this.commands = opts.commands || {}
  }
}
