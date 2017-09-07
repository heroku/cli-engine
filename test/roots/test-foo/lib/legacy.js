'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.convertFromV5 = convertFromV5;

require('cli-engine-command');

var _cliEngineHeroku = require('cli-engine-heroku');

var _vars = require('cli-engine-heroku/lib/vars');

var _vars2 = _interopRequireDefault(_vars);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function convertFromV5(c) {
  class V5 extends _cliEngineHeroku.Command {

    run() {
      let flags = this.flags;
      let args = this.argv;
      if (!c.variableArgs) {
        // turn args into object v5 expects
        args = {};
        for (let i = 0; i < this.argv.length; i++) {
          args[this.constructor.args[i].name] = this.argv[i];
        }
      }
      const ctx = {
        version: this.config.userAgent,
        supportsColor: this.out.color.enabled,
        auth: {},
        debug: this.config.debug,
        debugHeaders: this.config.debug > 1 || ['1', 'true'].includes(process.env.HEROKU_DEBUG_HEADERS),
        flags,
        args,
        app: flags.app,
        org: flags.org,
        team: flags.team,
        config: this.config,
        apiUrl: _vars2.default.apiUrl,
        herokuDir: this.config.cacheDir,
        apiToken: this.heroku.auth,
        apiHost: _vars2.default.apiHost,
        gitHost: _vars2.default.gitHost,
        httpGitHost: _vars2.default.httpGitHost,
        cwd: process.cwd()
      };
      ctx.auth.password = ctx.apiToken;
      const ansi = require('ansi-escapes');
      process.once('exit', () => {
        if (process.stderr.isTTY) {
          process.stderr.write(ansi.cursorShow);
        }
      });
      return c.run(ctx);
    }
  }

  V5.topic = c.topic;
  V5.command = c.command;
  V5.description = c.description;
  V5.hidden = !!c.hidden;
  V5.args = c.args || [];
  V5.flags = convertFlagsFromV5(c.flags);
  V5.variableArgs = !!c.variableArgs;
  V5.help = c.help;
  V5.usage = c.usage;
  V5.aliases = c.aliases || [];
  if (c.needsApp || c.wantsApp) {
    V5.flags.app = _cliEngineHeroku.flags.app({ required: !!c.needsApp });
    V5.flags.remote = _cliEngineHeroku.flags.remote();
  }
  if (c.needsOrg || c.wantsOrg) {
    let opts = { required: !!c.needsOrg, hidden: false, description: 'organization to use' };
    V5.flags.org = _cliEngineHeroku.flags.org(opts);
  }
  return V5;
}

function convertFlagsFromV5(flags) {
  if (!flags) return {};
  if (!Array.isArray(flags)) return flags;
  return flags.reduce((flags, flag) => {
    let opts = {
      char: flag.char,
      description: flag.description,
      hidden: flag.hidden,
      required: flag.required,
      optional: flag.optional,
      parse: flag.parse
    };
    Object.keys(opts).forEach(k => opts[k] === undefined && delete opts[k]);
    flags[flag.name] = flag.hasValue ? _cliEngineHeroku.flags.string(opts) : _cliEngineHeroku.flags.boolean(opts);
    return flags;
  }, {});
}