/*  Copyright (C) 2016 Milan Pässler
    Copyright (C) 2016 HopGlass Server contributors

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published
    by the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. */

'use strict'

var fs = require('fs')
var _ = require('lodash')
var async = require('async')

var config = {
  /* eslint-disable quotes */
  receivers: [
    { module: "announced" },
    { module: "alfred" },
    { module: "aliases",
      overlay: true
    }
  ],
  ifaces: [
    "bat0"
  ],
  storage: {
    interval: 300,
    file: "./raw.json"
  },
  purge: {
    maxAge: 14,      // in days
    interval: 86400  //  1 day
  }
}

module.exports = function (configData) {
  if (configData.ifaces)
    delete config.ifaces

  if (configData.receivers)
    delete config.receivers

  _.merge(config, configData)

  var receiverList = []
  var raw = {}
  var overlay = {}

  try {
    raw = JSON.parse(fs.readFileSync(config.storage.file, 'utf8'))
  } catch(err) {
    console.log(err)
  }

  var api = {}
  api.receiverCallback  = receiverCallback
  api.sharedConfig = config
  api.getRaw = getRaw
  for (let i in config.receivers) {
    var r = config.receivers[i]
    receiverList.push(require(__dirname + '/receiver/' + r.module)(i, r.config, api))
  }

  function receiverCallback(id, obj, receiverId) {
    var receiverConf = config.receivers[receiverId]

    if (!raw[id]) {
      raw[id] = {}
      raw[id].firstseen = new Date().toISOString()
    }

    if (receiverConf.overlay) {
      if (!overlay[id])
        overlay[id] = {}

      _.merge(overlay[id], obj)
      delete raw[id].lastupdate
      return
    }

    raw[id].lastseen = new Date().toISOString()

    if (!raw[id].lastupdate)
      raw[id].lastupdate = {}

    if (obj.nodeinfo) {
      raw[id].nodeinfo = obj.nodeinfo
      raw[id].lastupdate.nodeinfo = new Date().toISOString()
    }
    if (obj.statistics) {
      raw[id].statistics = obj.statistics
      raw[id].lastupdate.statistics = new Date().toISOString()
    }
    if (obj.neighbours) {
      raw[id].neighbours = obj.neighbours
      raw[id].lastupdate.neighbours = new Date().toISOString()
    }
  }

  function getRaw() {
    return _.merge({}, raw)
  }

  function getData(query) {
    var data = getRaw()
    _.merge(data, overlay)

    if (typeof query === 'object')
      data = filterData(data, query)

    return data
  }

  function filterData(data, query) {
    // filtern anhand der übergebenen Filterwerte
    switch (query.filter) {
    case 'site':
      return _.filter(data, function(o) {
        return _.get(o, 'nodeinfo.system.site_code', 'unknown') === query.value ? true : false
      })
    case 'firmware_release':
      return _.filter(data, function(o) {
        return _.get(o, 'nodeinfo.software.firmware.release', 'unknown') === query.value ? true : false
      })
    case 'firstseen':
      return _.filter(data, function(o) {
        var firstseen = (new Date(o.firstseen)).getTime()
        var now = (new Date()).getTime()
        var v = parseInt(query.value)*1000
        if (v >= 0) {
          return now - firstseen <= v ? true : false           // all nodes seen last n seconds
        } else {
          return now - firstseen > Math.abs(v) ? true : false  // all nodes not seen in last n seconds
        }
      })
    case 'lastseen':
      return _.filter(data, function(o) {
        var lastseen = (new Date(o.lastseen)).getTime()
        var now = (new Date()).getTime()
        var v = parseInt(query.value)*1000
        if (v >= 0) {
          return now - lastseen <= v ? true : false
        } else {
          return now - lastseen > Math.abs(v) ? true : false
        }
      })
    case 'uptime':
      return _.filter(data, function(o) {
        var uptime = parseInt(_.get(o, 'statistics.uptime', '-1'))
        var v = parseInt(query.value)
        if (v >= 0) {
          return uptime <= v ? true : false
        } else {
          return uptime > Math.abs(v) ? true : false
        }
      })
    case 'clients':
      return _.filter(data, function(o) {
        var clients = parseInt(_.get(o, 'statistics.clients.total', '-1'))
        var v = parseInt(query.value)
        if (v >= 0) {
          return clients >= v ? true : false
        } else {
          return clients < Math.abs(v) ? true : false
        }
      })
    case 'nodeid':
      return _.filter(data, function(o) {
        return _.get(o, 'nodeinfo.node_id') == query.value
      })
    default:
      return data
    }
  }

  function purgeData() {
    var now = new Date().getTime()
    async.forEachOf(raw, function(n, k, finished) {
      var lastseen = (new Date(n.lastseen)).getTime()
      if (now - lastseen >= config.purge.maxAge*86400*1000 || typeof n.lastseen === 'undefined') {
        console.info('purge old node ' + k)
        delete raw[k]
      }
      finished()
    })
  }
  purgeData()
  setInterval(purgeData, config.purge.interval*1000)

  function storeData() {
    try {
      var fn = fs.openSync(config.storage.file + '.tmp', 'w')
      fs.writeSync(fn, JSON.stringify(getRaw()))
      fs.fsyncSync(fn) // take care that it was actually written to disk
      fs.closeSync(fn)
      fs.renameSync(config.storage.file + '.tmp', config.storage.file) // prevent overwriting with an unfinished backup (happens if disk is full)
    } catch(err) {
      console.error(err)
    }
  }
  setInterval(storeData, config.storage.interval*1000)

  process.on('SIGINT', function () {
    storeData()
    process.exit(2)
  })

  process.on('SIGTERM', function () { // systemd kills with SIGTERM
    storeData()
    process.exit(0)
  })

  var exports = {}
  exports.getData = getData
  exports.getRaw  = getRaw
  return exports
}
