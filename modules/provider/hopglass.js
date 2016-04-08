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

var async = require('async')
var _ = require('lodash')


module.exports = function(getData, config) {
  var data = {}

  function isOnline(node) {
    if (node)
      return Math.abs((node.lastseen ? new Date(node.lastseen) : new Date()) - new Date()) < config.offlineTime * 1000
    else
      return true
  }
  
  function parsePeerGroup(pg) {
    for (let i in pg) {
      if (i == 'peers') {
        for (let j in pg[i]) {
          if (pg[i][j])
            return true
        }
      } else {
        if (parsePeerGroup(pg[i]))
          return true
      }
    }
  }
  
  function getNodesJson(stream) {
    data = getData()
    var nJson = {}
    nJson.version = 2
    nJson.nodes = []
    nJson.timestamp = new Date().toISOString()
    async.forEachOf(data, function(n, k, finished) {
      if (n.nodeinfo) {
        var node = {}
        node.nodeinfo = _.get(n, 'nodeinfo', {})
        node.flags = {}
        node.flags.gateway = _.get(n, 'flags.gateway')
        node.flags.online = isOnline(n)
        node.flags.uplink = parsePeerGroup(_.get(n, 'statistics.mesh_vpn'))
        node.statistics = {}
        node.statistics.uptime = _.get(n, 'statistics.uptime')
        node.statistics.gateway = _.get(n, 'statistics.gateway')
        if (_.has(n, 'statistics.memory'))
          node.statistics.memory_usage =
              (_.get(n, 'statistics.memory.total', 0)
             - _.get(n, 'statistics.memory.free', 0))
             / _.get(n, 'statistics.memory.total', 0)
        node.statistics.rootfs_usage = _.get(n, 'statistics.rootfs_usage')
        node.statistics.clients = _.get(n, 'statistics.clients.total', 0)
        node.statistics.loadavg = _.get(n, 'statistics.loadavg')
        node.lastseen = _.get(n, 'lastseen', new Date().toISOString())
        node.firstseen = _.get(n, 'firstseen', new Date().toISOString())
        nJson.nodes.push(node)
      }
      finished()
    }, function() {
      stream.writeHead(200, { 'Content-Type': 'application/json' })
      stream.write(JSON.stringify(nJson))
      stream.end()
    })
  }
  
  function getGraphJson(stream) {
    data = getData()
    var gJson = {}
    gJson.timestamp = new Date().toISOString()
    gJson.version = 1
    gJson.batadv = {}
    gJson.batadv.multigraph = false
    gJson.batadv.directed = true
    gJson.batadv.nodes = []
    gJson.batadv.links = []
    gJson.batadv.graph = null
    var nodeTable = {}
    var macTable = {}
    var typeTable = {}
    var counter = 0
    function createEntry(mac) {
      var nodeEntry = {}
      nodeEntry.id = mac
      nodeEntry.node_id = macTable[mac]
      nodeTable[mac] = counter
      var node = data[macTable[mac]]
      for (let m in _.get(node, 'neighbours.batadv')) {
        nodeTable[m] = counter
      }
      if (!isOnline(node))
        nodeEntry.unseen = true
      counter++
      gJson.batadv.nodes.push(nodeEntry)
    }
    async.forEachOf(data, function(n, k, finished1) {
      if (_.has(n, 'neighbours.batadv') && _.has(n, 'nodeinfo.network.mac'))
        for (let mac in n.neighbours.batadv) {
          macTable[mac] = k
        }
      if (_.has(n, 'nodeinfo.network.mesh'))
        for (let bat in n.nodeinfo.network.mesh) {
          for (let type in n.nodeinfo.network.mesh[bat].interfaces) {
            n.nodeinfo.network.mesh[bat].interfaces[type].forEach(function(d) {
              typeTable[d] = type
            })
          }
        }
      finished1()
    }, function() {
      async.forEachOf(data, function(n, k, finished2) {
        if (_.has(n, 'neighbours.batadv') && isOnline(n)) {
          for (let dest in n.neighbours.batadv) {
            if (_.has(n.neighbours.batadv[dest], 'neighbours'))
              for (let src in n.neighbours.batadv[dest].neighbours) {
                var link = {}
                link.source = nodeTable[src]
                link.target = nodeTable[dest]
                var tq = _.get(n, ['neighbours', 'batadv', dest, 'neighbours', src, 'tq'])
                link.tq = 255 / (tq ? tq : 1)
                link.type = typeTable[dest]
                if (isNaN(link.source)) {
                  //unknown node (not in data) -> create nodeentry
                  createEntry(src)
                  link.source = nodeTable[src]
                }
                if (isNaN(link.target)) {
                  createEntry(dest)
                  link.target = nodeTable[dest]
                }
                gJson.batadv.links.push(link)
              }
          }
        }
        finished2()
      }, function() {
        stream.writeHead(200, { 'Content-Type': 'application/json' })
        stream.write(JSON.stringify(gJson))
        stream.end()
      })
    })
  }

  var exports = {}
  exports['nodes.json'] = getNodesJson
  exports['graph.json'] = getGraphJson
  return exports
}
