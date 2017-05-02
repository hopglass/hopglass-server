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


module.exports = function(receiver, config) {

  function isOnline(node) {
    if (node)
      return Math.abs((node.lastseen ? new Date(node.lastseen) : new Date()) - new Date()) < config.offlineTime * 1000

    return true
  }

  function getNodesJson(stream, query) {
    var data = receiver.getData(query)
    var nJson = {}
    nJson.version = 2
    nJson.nodes = []
    nJson.timestamp = new Date().toISOString()
    var macTable = {}
    async.forEachOf(data, function(n, k, finished) {
      if (_.has(n, 'nodeinfo.network.mesh')) {
        for (let bat in n.nodeinfo.network.mesh) {
          for (let type in n.nodeinfo.network.mesh[bat].interfaces) {
            n.nodeinfo.network.mesh[bat].interfaces[type].forEach(function(d) {
              macTable[d] = k
            })
          }
        }
      }
      finished()
    }, function() {
      async.forEachOf(data, function(n, k, finished) {
        if (n.nodeinfo) {
          var node = {}
          node.nodeinfo = _.get(n, 'nodeinfo', {})
          node.flags = {}
          node.flags.gateway = _.get(n, 'flags.gateway')
          node.flags.online = isOnline(n)
          node.statistics = {}
          if (node.flags.online) {
            node.statistics.uptime = _.get(n, 'statistics.uptime')
            node.statistics.gateway = _.get(n, 'statistics.gateway')
            if (node.statistics.gateway in macTable)
              node.statistics.gateway = macTable[node.statistics.gateway]
            node.statistics.gateway_nexthop = _.get(n, 'statistics.gateway_nexthop')
            if (node.statistics.gateway_nexthop in macTable)
              node.statistics.gateway_nexthop = macTable[node.statistics.gateway_nexthop]
            node.statistics.nexthop = _.get(n, 'statistics.nexthop')
            if (node.statistics.nexthop in macTable)
              node.statistics.nexthop = macTable[node.statistics.nexthop]
            if (_.has(n, 'statistics.wireless')) {
              node.statistics.wireless = {}
              if (Array.isArray(n.statistics.wireless)) {
                for (let freq of n.statistics.wireless)
                  if (freq.frequency && freq.busy && freq.rx && freq.tx) {
                    var newfreq = {}
                    newfreq.rx = freq.rx / freq.active
                    newfreq.tx = freq.tx / freq.active
                    newfreq.wait = (freq.busy - freq.rx - freq.tx) / freq.active
                    newfreq.free = (freq.active - freq.busy) / freq.active
                    node.statistics.wireless['airtime'+freq.frequency.toString().substring(0, 1)] = newfreq
                  }
              } else {
                if (_.has(n, 'statistics.wireless.airtime2'))
                  node.statistics.wireless.airtime2 = _.get(n, 'statistics.wireless.airtime2')
                if (_.has(n, 'statistics.wireless.airtime5'))
                  node.statistics.wireless.airtime5 = _.get(n, 'statistics.wireless.airtime5')
              }
            }
            if (_.has(n, 'statistics.memory'))
              node.statistics.memory_usage =
                  (_.get(n, 'statistics.memory.total', 0)
                - _.get(n, 'statistics.memory.free', 0)
                - _.get(n, 'statistics.memory.buffers', 0)
                - _.get(n, 'statistics.memory.cached', 0))
                / _.get(n, 'statistics.memory.total', 0)
            node.statistics.rootfs_usage = _.get(n, 'statistics.rootfs_usage')
            node.statistics.clients = _.get(n, 'statistics.clients.total', 0)
            node.statistics.loadavg = _.get(n, 'statistics.loadavg')
          }
          node.lastseen = _.get(n, 'lastseen', new Date().toISOString())
          node.firstseen = _.get(n, 'firstseen', new Date().toISOString())
          nJson.nodes.push(node)
        }
        finished()
      }, function() {
        stream.writeHead(200, { 'Content-Type': 'application/json' })
        stream.end(JSON.stringify(nJson))
      })
    })
  }

  function getGraphJson(stream, query) {
    var data = receiver.getData(query)
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
      if (_.has(node, 'neighbours.batadv'))
        for (let m in _.get(node, 'neighbours.batadv')) {
          nodeTable[m] = counter
        }
      if (_.has(node, 'nodeinfo.network.mesh'))
        for (let bat in node.nodeinfo.network.mesh) {
          for (let type in node.nodeinfo.network.mesh[bat].interfaces) {
            if (typeof node.nodeinfo.network.mesh[bat].interfaces[type].forEach == 'function')
              node.nodeinfo.network.mesh[bat].interfaces[type].forEach(function(m) {
                nodeTable[m] = counter
              })
          }
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
            if (typeof n.nodeinfo.network.mesh[bat].interfaces[type].forEach == 'function')
              n.nodeinfo.network.mesh[bat].interfaces[type].forEach(function(d) {
                typeTable[d] = type
                macTable[d] = k
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

                var ts = typeTable[src], td = typeTable[dest]
                if (ts === 'l2tp' || td === 'l2tp') {
                  link.type = 'l2tp'
                } else if (ts === 'fastd' || td === 'fastd') {
                  link.type = 'fastd'
                } else if (ts === 'tunnel' || td === 'tunnel') {
                  link.type = 'tunnel'

                  if (td === 'tunnel' && (ts == undefined || ts === 'tunnel')) {
                    var fds = 0, tds = 0, sis = 0
                    if (_.get(data[macTable[dest]], 'nodeinfo.software.fastd.enabled', false)) fds++
                    if (_.get(data[macTable[src]], 'nodeinfo.software.fastd.enabled', false)) fds++
                    if (_.get(data[macTable[dest]], 'nodeinfo.software.tunneldigger.enabled', false)) tds++
                    if (_.get(data[macTable[src]], 'nodeinfo.software.tunneldigger.enabled', false)) tds++
                    if (_.has(data[macTable[dest]], 'nodeinfo.software')) sis++
                    if (_.has(data[macTable[src]], 'nodeinfo.software')) sis++
                    if (sis == fds && fds > 0) link.type = 'fastd'
                    if (sis == tds && tds > 0) link.type = 'l2tp'
                  }
                } else
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
        stream.end(JSON.stringify(gJson))
      })
    })
  }

  var exports = {
    /* eslint-disable quotes */
    "nodes.json": getNodesJson,
    "graph.json": getGraphJson
  }
  return exports
}
