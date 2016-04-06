'use strict'

module.exports = function (raw, config) {
  var exports = {}
  exports.announced = require('./receiver/announced')(raw, config)

  return exports
}
