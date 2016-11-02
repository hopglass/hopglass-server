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

var dgram = require('dgram')
var zlib = require('zlib')
var _ = require('lodash')

var config = {
  /* eslint-disable quotes */
  "target": {
    "ip": "ff02::1",
    "port": 1001
  },
  "port": 45123,
  "interval": {
    "statistics": 60,
    "nodeinfo": 500
  }
}

delete require.cache[__filename]

module.exports = function(receiverId, configData, api) {
  _.merge(config, configData)

  var collector = dgram.createSocket('udp6')

  //collector callbacks
  collector.on('error', function(err) {
    throw(err)
  })

  collector.on('listening', function() {
    collector.setTTL(1) // restrict hop-limit to own subnet / should prevent loops (default was: 64)
    console.log('collector listening on port ' + config.port)
  })

  collector.on('message', function(msg) {
    zlib.inflateRaw(msg, function(err, res) {
      if (err) {
        console.log('ERR: ' + err)
      } else {
        try {
          var obj = JSON.parse(res)
          var id
          if (obj.nodeinfo) {
            id = obj.nodeinfo.node_id
          } else if (obj.statistics) {
            id = obj.statistics.node_id
          } else if (obj.neighbours) {
            id = obj.neighbours.node_id
          } else return
          api.receiverCallback(id, obj, receiverId)
        }
        catch (err) {
          console.log('JSON.parse ERROR! ' + err)
        }
      }
    })
  })

  function retrieve(stat, address) {
    var ip = address ? address : config.target.ip
    var req = new Buffer('GET ' + stat)
    api.sharedConfig.ifaces.forEach(function(iface) {
      collector.send(req, 0, req.length, config.target.port, ip + '%' + iface, function (err) {
        if (err) console.error(err)
      })
    })
  }

  collector.bind(config.port)

  retrieve('nodeinfo')
  retrieve('neighbours')
  retrieve('statistics')

  setInterval(function() {
    retrieve('nodeinfo')
  }, config.interval.nodeinfo * 1000)

  setInterval(function() {
    retrieve('neighbours')
    setTimeout(function() {
      retrieve('statistics')
    }, 6000);
  }, config.interval.statistics * 1000)
}
