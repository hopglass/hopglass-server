'use strict'

var _ = require("lodash")

var config = {
  hopglass: {
    offlineTime: 1800
  }
}

module.exports = function (getData, configData) {
  _.merge(config, configData)

  var out = {}
  _.merge(out, require('./provider/hopglass')(getData, config))
  _.merge(out, require('./provider/utilities')(getData))

  return out
}
