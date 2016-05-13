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
  if (configData.ifaces && configData.ifaces.length > 0)
    delete config.ifaces

  _.merge(config, configData)

  var receiverList = {}
  var raw = {}

  try {
    raw = JSON.parse(fs.readFileSync(config.storage.file, 'utf8'))
  } catch(err) {
    console.log(err)
  }

  require('fs').readdirSync(__dirname + '/receiver').forEach(function(e) {
    var re = /\.js$/
    if (re.test(e))
      receiverList[e.replace(re, '')] = require(__dirname + '/receiver/' + e)(config, receiver_Callback)
  })

  function receiver_Callback(id, obj) {
    if (!raw[id]) {
      raw[id] = {}
      raw[id].firstseen = new Date().toISOString()
    }
    raw[id].lastseen = new Date().toISOString()

    _.forEach(obj, function(n, k) {
      raw[id][k] = n
    })
  }

  function getRaw() {
    return raw
  }

  function getData(query) {
    var data = getRaw()
    _.forEach(receiverList, function(e) {
      if (e.overwrite) {
        data = _.merge(data, e.getRaw())
      }
    })

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
