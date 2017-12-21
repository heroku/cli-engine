import {ICommandInfo} from './command'

export interface INestedTopic {
  description?: string
  subtopics?: {[k: string]: INestedTopic}
  commands?: {[k: string]: ICommandInfo}
  hidden?: boolean
}

export interface ITopic extends INestedTopic{
  name: string
}

function instantiateTopic (t: Topic | ITopic): Topic {
  return t instanceof Topic ? t : new Topic(t)
}

function topicOf (id: string): string {
  return id.split(':').slice(0, -1).join(':')
}

function keyOf (id: string): string {
  return id.split(':').slice(-1).join(':')
}

export class Topic implements ITopic {
  public subtopics: {[k: string]: Topic} = {}
  public commands: {[k: string]: ICommandInfo} = {}
  public name: string
  public description?: string
  public hidden: boolean

  constructor(opts: ITopic) {
    this.name = opts.name
    this.description = opts.description
    this.hidden = !!opts.hidden
    this.commands = opts.commands || {}
    this.subtopics = Object
      .entries(opts.subtopics || {})
      .map(([k,v]) => new Topic({...v, name: `${this.name}:${k}`}))
      .reduce((obj, t) => {obj[t.name] = t; return obj}, {} as {[k: string]: Topic})
  }

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

export class LoadResult {
  public topics: {[k: string]: Topic} = {}
  public commands: {[k: string]: ICommandInfo} = {}

  public addTopics (topics: LoadResult['topics']) {
    for (let t of Object.values(topics).map(instantiateTopic)) {
      let base = this.findOrCreateTopic(t.name)
      base.description = t.description || base.description
      base.hidden = t.hidden || base.hidden
      this.addTopics(t.subtopics)
      this.addCommands(t.commands)
    }
  }

  public addCommands (commands: LoadResult['commands']) {
    for (let c of Object.values(commands)) {
      let topicID = topicOf(c.id)
      let topic = topicID ? this.findOrCreateTopic(topicID) : this
      topic.commands[keyOf(c.id)] = c
    }
  }

  private findOrCreateTopic (name: string): Topic {
    let key = keyOf(name)
    let parentID = topicOf(name)
    let topics = this.topics
    if (parentID) {
      let parent = this.findOrCreateTopic(parentID)
      topics = parent.subtopics
    }
    return topics[key] = topics[key] || new Topic({name})
  }
}
