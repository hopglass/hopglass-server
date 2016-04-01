'use strict'

module.exports = function(raw, config) {
  var dgram = require('dgram')
  var zlib = require('zlib')
  var _ = require('lodash')
  
  var collector = dgram.createSocket('udp6')
  var raw = {}
  
  //collector callbacks
  collector.on('error', function(err) {
    console.log(`collector error:\n${err.stack}`)
    collector.close()
    process.exit(1)
  })
  
  collector.on('listening', function() {
    console.log('collector listening on port ' + config.collectorport)
  })
  
  collector.on('message', function(msg, rinfo) {
    zlib.inflateRaw(msg, function(err, res) {
      if (err) {
        console.log('ERR: ' + err)
      } else {
        var obj = JSON.parse(res)
        var id
        if (obj.nodeinfo) {
          id = obj.nodeinfo.node_id
        } else if (obj.statistics) {
          id = obj.statistics.node_id
        } else if (obj.neighbours) {
          id = obj.neighbours.node_id
        } else return
  
        if (!raw[id]) {
          raw[id] = {}
          raw[id].firstseen = new Date().toISOString()
        }
  
        if (obj.nodeinfo)
          raw[id].nodeinfo = obj.nodeinfo
        else if (obj.statistics)
          raw[id].statistics = obj.statistics
        else if (obj.neighbours)
          raw[id].neighbours = obj.neighbours
        raw[id].lastseen = new Date().toISOString()
        if (obj.statistics || obj.neighbours && !raw[id].nodeinfo) {
          retrieve('nodeinfo', rinfo.address)
        }
      }
    })
  })
  
  function retrieve(stat, address) {
    var ip = address ? address : config.targetip
    var req = new Buffer('GET ' + stat)
    for (let iface in config.ifaces) {
      collector.send(req, 0, req.length, config.targetport, ip + '%' + iface)
    }
  }
  
  collector.bind(config.collectorport)
  
  retrieve('nodeinfo')
  retrieve('neighbours')
  retrieve('statistics')
  
  setInterval(function() {
    retrieve('nodeinfo')
  }, config.nodeinfoInterval * 1000)
  
  setInterval(function() {
    retrieve('neighbours')
    retrieve('statistics')
  }, config.statisticsInterval * 1000)
  
  function getRaw() {
    return raw
  }

  var exports = {}
  exports.getRaw = getRaw

  return exports
}
