declare module 'execa' {
  declare export type Options = {
    stripEof?: boolean,
    preferLocal?: boolean,
    input?: string | Buffer | stream$Readable,
    reject?: boolean,
    cleanup?: boolean
  };

  declare module.exports: {
    (file: string, arguments?: string[], options?: Options): Promise<child_process$ChildProcess>
  };
}
