#!/usr/bin/node
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

  //nodelist.json (yet another format)
  function getNodelistJson(stream) {
    data = getData()
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
      stream.write(JSON.stringify(nl))
      stream.end()
    })
  }

  return {
    "nodelist.json": getNodelistJson
  }
}
