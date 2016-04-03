'use strict'

var _ = require("lodash")

var config = {
  announced: {
    target: {
      ip: "ff02::1",
      port: 1001
    },
    port: 45123,
    interval: {
      statistics: 60,
      nodeinfo: 500
    }
  },
  ifaces: [
    "bat0",
    "enp4s0"
  ]
}

module.exports = function (raw, configData) {
  console.log(configData.ifaces)
  if (configData && configData.ifaces && configData.ifaces.length > 0) {
      delete config.ifaces          // remove default-value
  }

  _.merge(config, configData)

  var out = {}
  out.announced = require('./receiver/announced')(raw, config)

  return out
}
