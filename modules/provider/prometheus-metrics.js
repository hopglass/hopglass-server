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
    else
      return true
  }

  //Prometheus metrics
  function getMetrics(stream, query) {
    stream.writeHead(200, { 'Content-Type': 'text/plain' })
    var data = receiver.getData(query)
    var save = function(n, id, stream, what, where) {
      if (_.has(n, what))
        stream.write((where ? where : what.replace(/\./g, '_')) + id + ' ' +  _.get(n, what) + '\n')
    }
    function get(n, what) {
      if (_.has(n, what))
        return _.get(n, what)
      else
        return 0;
    }
    var counter_meshnodes_online_total = 0
    var counter_meshnodes_total = 0
    var counter_traffic_rx = 0
    var counter_traffic_mgmt_rx = 0
    var counter_traffic_tx = 0
    var counter_traffic_mgmt_tx = 0
    var counter_traffic_forward = 0
    var counter_clients = 0
    var nodeTable = {}
    async.forEachOf(data, function(n, k, finished1) {
      counter_meshnodes_total++
      if (isOnline(n)) {
        counter_meshnodes_online_total++
        if (_.has(n, 'nodeinfo.hostname') && _.has(n, 'statistics.gateway') && isOnline(n)) {
          var id = '{hostname="' + _.get(n, 'nodeinfo.hostname',"") + '",nodeid="' + k + '",gateway="' + _.get(n, 'statistics.gateway') + '"}'
          save(n, id, stream, 'statistics.clients.total')
          save(n, id, stream, 'statistics.uptime')
          save(n, id, stream, 'statistics.traffic.rx.bytes')
          save(n, id, stream, 'statistics.traffic.mgmt_rx.bytes')
          save(n, id, stream, 'statistics.traffic.tx.bytes')
          save(n, id, stream, 'statistics.traffic.mgmt_tx.bytes')
          save(n, id, stream, 'statistics.traffic.forward.bytes')
          save(n, id, stream, 'statistics.loadavg')
          if (_.has(n, 'statistics.memory.free') && _.has(n, 'statistics.memory.total'))
            stream.write('statistics_memory_usage' + id + ' ' + (n.statistics.memory.total - n.statistics.memory.free)/n.statistics.memory.total + '\n')
        }
        counter_traffic_rx += get(n, 'statistics.traffic.rx.bytes')
        counter_traffic_mgmt_rx += get(n, 'statistics.traffic.mgmt_rx.bytes')
        counter_traffic_tx += get(n, 'statistics.traffic.tx.bytes')
        counter_traffic_mgmt_tx += get(n, 'statistics.traffic.mgmt_tx.bytes')
        counter_traffic_forward += get(n, 'statistics.traffic.forward.bytes')
        counter_clients += get(n, 'statistics.clients.total')
      }
  
      if (_.has(n, 'neighbours.batadv') && isOnline(n))
        for (let mac in n.neighbours.batadv)
          nodeTable[mac] = k
  
      finished1()
    }, function() {
      async.forEachOf(data, function(n, k, finished2) {
        if (_.has(n, 'neighbours.batadv') && isOnline(n)) {
          for (let dest in n.neighbours.batadv) {
            if (_.has(n.neighbours.batadv[dest], 'neighbours'))
              for (let src in n.neighbours.batadv[dest].neighbours) {
                var source = nodeTable[src]
                var target = nodeTable[dest]
                var tq = _.get(n, ['neighbours', 'batadv', dest, 'neighbours', src, 'tq']) / 255
                if (source === undefined) {
                  source = src.replace(/:/g, '')
                }
                var source_name = _.get(data, [source, 'nodeinfo', 'hostname'], source)
                var target_name = _.get(data, [target, 'nodeinfo', 'hostname'], target)
                stream.write('link_tq{source="' + source + '",target="' + target
                  + '",source_name="' + source_name + '",target_name="' + target_name + '"} ' + tq + '\n')
              }
          }
        }
        finished2()
      }, function() {
        stream.write('meshnodes_total ' + counter_meshnodes_total + '\n')
        stream.write('meshnodes_online_total ' + counter_meshnodes_online_total + '\n')
        stream.write('total_clients ' + counter_clients + '\n')
        stream.write('total_traffic_rx ' + counter_traffic_rx + '\n')
        stream.write('total_traffic_mgmt_rx ' + counter_traffic_mgmt_rx + '\n')
        stream.write('total_traffic_tx ' + counter_traffic_tx + '\n')
        stream.write('total_traffic_mgmt_tx ' + counter_traffic_mgmt_tx + '\n')
        stream.write('total_traffic_forward ' + counter_traffic_forward + '\n')
        stream.end()
      })
    })
  }

  return {
    'metrics': getMetrics
  }
}
