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

module.exports = function (receiver, config) {
  function isOnline (node) {
    if (node)
      return Math.abs((node.lastseen ? new Date(node.lastseen) : new Date()) - new Date()) < config.offlineTime * 1000
    else
      return true
  }

  /** http://netjson.org/rfc.html#NetworkGraph **/
  function getNetworkGraph (stream, query) {
    var data = receiver.getData(query)
    var outputJson = {}
    outputJson.type = 'NetworkGraph'
    outputJson.label = 'NetJSON network graph'
    outputJson.protocol = 'batman-adv'
    outputJson.version = null
    outputJson.metric = null
    outputJson.nodes = []
    outputJson.links = []

    var interfaceList = {}

    async.forEachOf(data, function (n, k, finished) {
      if (n.nodeinfo) {
        var nodeid = _.get(n, 'nodeinfo.node_id', '')

        if (_.has(n, 'nodeinfo.network.mesh')) {
          for (let bat in n.nodeinfo.network.mesh) {
            for (let type in n.nodeinfo.network.mesh[bat].interfaces) {
              if (typeof n.nodeinfo.network.mesh[bat].interfaces[type].forEach === 'function') {
                n.nodeinfo.network.mesh[bat].interfaces[type].forEach(function (d) {
                  interfaceList[d] = {}
                  interfaceList[d].id = nodeid
                  interfaceList[d].type = type
                })
              }
            }
          }
        }

        var node = {}
        node.id = nodeid
        node.label = _.get(n, 'nodeinfo.hostname', '')
        node.local_addresses = _.get(n, 'nodeinfo.network.addresses', [])
        node.properties = {}
        node.properties.site = _.get(n, 'nodeinfo.system.site_code', '')
        node.properties.type = (_.get(n, 'flags.gateway', false) || _.get(n, 'statistics.gateway', null) === null ? 'gateway' : 'node')

        outputJson.nodes.push(node)
      }
      finished()
    }, function () {
      async.forEachOf(data, function (n, k, finished) {
        if (_.has(n, 'neighbours.batadv') && isOnline(n)) {
          for (let src in n.neighbours.batadv) {
            if (_.has(n.neighbours.batadv[src], 'neighbours')) {
              for (let dst in n.neighbours.batadv[src].neighbours) {
                var link = {}
                link.source = _.get(interfaceList, [src, 'id'], null)
                link.target = _.get(interfaceList, [dst, 'id'], null)
                link.cost = 1 - _.get(n, ['neighbours', 'batadv', src, 'neighbours', dst, 'tq'], 0) / 255
                link.properties = {}
                link.properties.type = interfaceList[src].type

                outputJson.links.push(link)
              }
            }
          }
        }
        finished()
      }, function () {
        stream.writeHead(200, { 'Content-Type': 'application/json' })
        stream.end(JSON.stringify(outputJson))
      })
    })
  }

  var exports = {
    /* eslint-disable quotes */
    'NetworkGraph.json': getNetworkGraph
  }
  return exports
}
