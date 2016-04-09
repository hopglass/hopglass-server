'use strict'

module.exports = function (raw, config) {
  var exports = {}

  //var announced = require('./receiver/announced')(raw, config)
  //var alfred = require('./receiver/alfred')(raw, config)

  var announced = require('./receiver/announced')({}, config)
  var alfred = require('./receiver/alfred')({}, config)

  function getRaw() {
    return alfred.getRaw()
  }

  var exports = {}

  exports.getRaw = getRaw
  return exports
}
