/*  Copyright (C) 2019 Milan Pässler
    Copyright (C) 2019 HopGlass Server contributors

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
    else
      return true
  }

  //nodelist.json (yet another format)
  function getNodelistJson(stream, query) {
    var data = receiver.getData(query)
    var nl = {}
    nl.version = '1.0.0'
    nl.updated_at = new Date().toISOString()
    nl.nodes = []
    async.forEachOf(data, function(n, k, finished) {
      var node = {}
      node.id = k
      node.name = _.get(n, 'nodeinfo.hostname')
      node.status = {}
      node.status.lastcontact = _.get(n, 'lastseen', new Date().toISOString())
      node.status.firstcontact = _.get(n, 'firstseen', new Date().toISOString())
      node.status.online = isOnline(n)
      node.status.clients = _.get(n, 'statistics.clients.total')
      if (_.has(n, 'nodeinfo.location.latitude') && _.has(n, 'nodeinfo.location.longitude')) {
        node.position = {}
        node.position.lat = _.get(n, 'nodeinfo.location.latitude')
        node.position.long = _.get(n, 'nodeinfo.location.longitude')
      }
      nl.nodes.push(node)
      finished()
    }, function() {
      stream.writeHead(200, { 'Content-Type': 'application/json' })
      stream.end(JSON.stringify(nl))
    })
  }

  return {
    /* eslint-disable quotes */
    "nodelist.json": getNodelistJson
  }
}
