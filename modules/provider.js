'use strict'

var _ = require("lodash")

module.exports = function (getData, config) {
  var exports = {}
  _.merge(exports, require('./provider/hopglass')(getData, config))
  _.merge(exports, require('./provider/nodelist')(getData, config))
  _.merge(exports, require('./provider/utilities')(getData))

  return exports
}
