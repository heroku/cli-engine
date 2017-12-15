"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = y[op[0] & 2 ? "return" : op[0] ? "throw" : "next"]) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [0, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
var heroku_cli_color_1 = require("heroku-cli-color");
var cli_ux_1 = require("cli-ux");
var cli_engine_command_1 = require("cli-engine-command");
var list_1 = require("cli-ux/lib/list");
var plugins_1 = require("../plugins");
var deps_1 = require("../deps");
var ts_lodash_1 = require("ts-lodash");
function topicSort(a, b) {
    if (a[0] < b[0])
        return -1;
    if (a[0] > b[0])
        return 1;
    return 0;
}
function buildHelp(config, c) {
    if (c.buildHelp)
        return c.buildHelp(config);
    var help = new deps_1["default"].CLICommandHelp(config);
    return help.command(c);
}
function buildHelpLine(config, c) {
    if (c.buildHelpLine)
        return c.buildHelpLine(config);
    var help = new deps_1["default"].CLICommandHelp(config);
    return help.commandLine(c);
}
var Help = /** @class */ (function (_super) {
    __extends(Help, _super);
    function Help() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    Help.prototype.run = function () {
        return __awaiter(this, void 0, void 0, function () {
            var subject, topics_1, rootCmds, topic, matchedCommand;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        this.plugins = new plugins_1.Plugins({ config: this.config });
                        return [4 /*yield*/, this.plugins.init()];
                    case 1:
                        _a.sent();
                        subject = this.argv.find(function (arg) { return !['-h', '--help'].includes(arg); });
                        if (!subject && !['-h', '--help', 'help'].includes(this.config.argv[2]))
                            subject = this.config.argv[2];
                        if (!!subject) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.topics()];
                    case 2:
                        topics_1 = _a.sent();
                        if (this.flags.all) {
                            rootCmds = this.plugins.rootCommandIDs;
                            rootCmds = rootCmds.filter(function (c) { return !topics_1.find(function (t) { return c.startsWith(t[0]); }); });
                            if (rootCmds)
                                this.listCommandsHelp(rootCmds);
                        }
                        return [2 /*return*/];
                    case 3: return [4 /*yield*/, this.plugins.topics[subject]];
                    case 4:
                        topic = _a.sent();
                        return [4 /*yield*/, this.plugins.findCommand(subject)];
                    case 5:
                        matchedCommand = _a.sent();
                        if (!topic && !matchedCommand) {
                            return [2 /*return*/, this.notFound(subject)];
                        }
                        if (matchedCommand) {
                            cli_ux_1["default"].log(buildHelp(this.config, matchedCommand));
                        }
                        if (!topic) return [3 /*break*/, 7];
                        return [4 /*yield*/, this.topics(topic.name)];
                    case 6:
                        _a.sent();
                        this.listCommandsHelp(topic.commands, subject);
                        _a.label = 7;
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    Help.prototype.notFound = function (subject) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, deps_1["default"].NotFound.run({ argv: [subject] })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    Help.prototype.topics = function (prefix) {
        return __awaiter(this, void 0, void 0, function () {
            var idPrefix, topics;
            return __generator(this, function (_a) {
                idPrefix = prefix ? prefix + ":" : '';
                topics = Object.values(this.plugins.topics)
                    .filter(function (t) { return !t.hidden; })
                    .filter(function (t) { return t.name.startsWith(idPrefix); })
                    .filter(function (t) { return t.name.split(':').length <= (prefix || '').split(':').length + 1; })
                    .map(function (t) { return [" " + t.name, t.description ? heroku_cli_color_1.color.dim(t.description) : null]; });
                topics.sort(topicSort);
                if (!topics.length)
                    return [2 /*return*/, topics
                        // header
                    ];
                // header
                cli_ux_1["default"].log(heroku_cli_color_1.color.bold('Usage:') + " " + this.config.bin + " " + idPrefix + "COMMAND\n\nHelp topics, type " + heroku_cli_color_1.color.cmd(this.config.bin + ' help TOPIC') + " for more details:");
                // display topics
                cli_ux_1["default"].log(list_1.renderList(topics));
                cli_ux_1["default"].log();
                return [2 /*return*/, topics];
            });
        });
    };
    Help.prototype.listCommandsHelp = function (commandIDs, topic) {
        var _this = this;
        var commands = commandIDs
            .map(function (id) { return _this.plugins.findCommand(id); })
            .filter(function (c) { return c && !c.hidden; });
        if (commands.length === 0)
            return;
        ts_lodash_1["default"].sortBy(commands, 'id');
        var helpCmd = heroku_cli_color_1.color.cmd(this.config.bin + " help " + (topic ? topic + ":" : '') + "COMMAND");
        if (topic) {
            cli_ux_1["default"].log(this.config.bin + " " + heroku_cli_color_1.color.bold(topic) + " commands: (get help with " + helpCmd + ")");
        }
        else {
            cli_ux_1["default"].log('Root commands:');
        }
        var helpLines = commands.map(function (c) { return buildHelpLine(_this.config, c); }).map(function (_a) {
            var a = _a[0], b = _a[1];
            return [" " + a, b];
        });
        cli_ux_1["default"].log(list_1.renderList(helpLines));
        cli_ux_1["default"].log();
    };
    Help.description = 'display help';
    Help.variableArgs = true;
    Help.flags = {
        all: cli_engine_command_1.flags.boolean({ description: 'show all commands' })
    };
    return Help;
}(cli_engine_command_1.Command));
exports["default"] = Help;
