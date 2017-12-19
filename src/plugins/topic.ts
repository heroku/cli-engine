export type Commands = { [k: string]: CommandInfo }
export type CommandInfo = {
  id: string
  hidden: boolean
  help: string
  helpLine: [string, string | undefined]
}

export type TopicOpts = {
  name: string
  description?: string
  hidden?: boolean
  commands?: Commands
  subtopics?: Topics
}

export type Topics = { [k: string]: Topic }

export class Topic {
  static parentTopicIDof(id: string) {
    return id
      .split(':')
      .slice(0, -1)
      .join(':')
  }

  static async findOrCreateTopic(opts: TopicOpts, topics: Topics): Promise<Topic> {
    if (opts.name.includes(':')) {
      let parent = await Topic.findOrCreateTopic({ name: this.parentTopicIDof(opts.name) }, topics)
      topics = parent.subtopics
    }
    if (!topics[opts.name]) {
      topics[opts.name] = new Topic(opts)
    } else {
      topics[opts.name] = await Topic.mergeTopics(topics[opts.name], opts)
    }
    return topics[opts.name]
  }

  static async mergeSubtopics(...subtopics: (Promise<Topics | undefined> | Topics | undefined)[]): Promise<Topics> {
    const topics: Topics = {}
    for (let p of subtopics) {
      for (let t of Object.values((await p) || {})) {
        if (!(t as TopicOpts).name) continue
        await Topic.findOrCreateTopic(t as TopicOpts, topics)
      }
    }
    return topics
  }

  static async mergeTopics(a: TopicOpts, b: TopicOpts) {
    return new Topic({
      ...b,
      ...a,
      commands: {
        ...(b || {}).commands,
        ...(a || {}).commands,
      },
      subtopics: await Topic.mergeSubtopics((a || {}).subtopics, (b || {}).subtopics),
    })
  }

  public name: string
  public description?: string
  public hidden: boolean
  public subtopics: Topics
  public commands: Commands

  constructor(opts: TopicOpts) {
    this.name = opts.name
    this.description = opts.description
    this.hidden = !!opts.hidden
    this.subtopics = opts.subtopics || {}
    this.commands = opts.commands || {}
  }
}
