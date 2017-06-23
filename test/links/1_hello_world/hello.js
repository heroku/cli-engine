module.exports.topic = {name: 'hello'}

module.exports = {
  commands: [{
    topic: 'hello',
    run: function (context) {
      var addon = require('bindings')('hello')
      addon.hello()
    }
  }]
}
