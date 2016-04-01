'use strict'

var _ = require("lodash")

module.exports = function (raw, config) {
  var exports = {}
  exports.announced = require('./receiver/announced')(raw, config)

  return exports
}
