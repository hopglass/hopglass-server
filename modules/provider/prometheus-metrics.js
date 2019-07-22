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

  function isOnline(node, pkg, offlineTime) {
    var lastseen
    if (pkg && _.has(node, 'lastupdate.' + pkg))
      lastseen = _.get(node, 'lastupdate.' + pkg)
    else
      lastseen = node.lastseen

    if (!offlineTime)
      if (pkg)
        offlineTime = config.metricsOfflineTime
      else
        offlineTime = config.offlineTime

    if (node)
      return Math.abs((lastseen ? new Date(lastseen) : new Date()) - new Date()) < offlineTime * 1000
    else
      return false
  }

  //Prometheus metrics
  function getMetrics(stream, query) {
    stream.writeHead(200, { 'Content-Type': 'text/plain' })
    var data = receiver.getData(query)
    function save(n, stream, labels, path, name, value) {
      var newLabels = []
      Object.keys(labels).map(function(key) {
        // escape special chars (\, ", newline)
        if (typeof labels[key] === 'string')
          labels[key] = labels[key].replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')
        newLabels.push(key + '="' + labels[key] + '"')
      })
      labels = '{' + newLabels.join(',') + '}'

      if (!value)
        value = _.get(n, path)

      if (isNaN(value))
        value = 0

      if (!name)
        name = path.replace(/\./g, '_')

      stream.write(name + labels + ' ' + value + '\n')
    }
    function get(n, what) {
      if (_.has(n, what))
        return _.get(n, what)
      else
        return 0
    }
    var counter = {}
    counter.meshnodes = {}
    counter.meshnodes.online = 0
    counter.meshnodes.total = 0
    counter.clients = 0
    counter.traffic = {}
    counter.traffic.forward = 0
    counter.traffic.rx = 0
    counter.traffic.tx = 0
    counter.traffic.mgmt = {}
    counter.traffic.mgmt.rx = 0
    counter.traffic.mgmt.tx = 0
    var nodeTable = {}
    var typeTable = {}
    async.forEachOf(data, function(n, k, finished1) {
      if (_.has(n, 'nodeinfo.network.mesh')) {
        for (let bat in n.nodeinfo.network.mesh) {
          for (let type in n.nodeinfo.network.mesh[bat].interfaces) {
            if (typeof n.nodeinfo.network.mesh[bat].interfaces[type].forEach == 'function')
              n.nodeinfo.network.mesh[bat].interfaces[type].forEach(function(d) {
                typeTable[d] = type
              })
          }
        }
      }
      counter.meshnodes.total++

      if (isOnline(n))
        counter.meshnodes.online++

      var labels = {}
      labels['nodeid'] = k

      if (_.has(n, 'nodeinfo.hostname'))
        labels['hostname'] = _.get(n, 'nodeinfo.hostname')

      if (isOnline(n, 'statistics') && _.has(n, 'statistics.gateway'))
        labels['gateway'] = _.get(n, 'statistics.gateway')

      if (_.has(n, 'nodeinfo.system.site_code'))
        labels['site'] = _.get(n, 'nodeinfo.system.site_code')

      if (_.has(n, 'nodeinfo.software.firmware.release'))
        labels['firmware'] = _.get(n, 'nodeinfo.software.firmware.release')

      if (_.has(n, 'nodeinfo.hardware.model'))
        labels['model'] = _.get(n, 'nodeinfo.hardware.model')

      save(n, stream, labels, null, 'online', isOnline(n) ? 1 : 0)

      delete labels['gateway']
      delete labels['firmware']

      if (isOnline(n)) {
        counter.clients += get(n, 'statistics.clients.total')
      }

      if (isOnline(n, 'statistics')) {
        save(n, stream, labels, 'statistics.clients.total')
        save(n, stream, labels, 'statistics.uptime')
        save(n, stream, labels, 'statistics.loadavg')
        save(n, stream, labels, 'statistics.rootfs_usage')

        if (_.has(n, 'statistics.memory.free') && _.has(n, 'statistics.memory.total'))
          save(n, stream, labels, 'statistics_memory_usage', null, (n.statistics.memory.total - n.statistics.memory.free) / n.statistics.memory.total)

        labels['mtype'] = 'user'
        labels['type'] = 'forward'
        save(n, stream, labels, 'statistics.traffic.forward.bytes', 'statistics_traffic')
        labels['type'] = 'rx'
        save(n, stream, labels, 'statistics.traffic.rx.bytes', 'statistics_traffic')
        labels['type'] = 'tx'
        save(n, stream, labels, 'statistics.traffic.tx.bytes', 'statistics_traffic')

        labels['mtype'] = 'mgmt'
        labels['type'] = 'rx'
        save(n, stream, labels, 'statistics.traffic.mgmt_rx.bytes', 'statistics_traffic')
        labels['type'] = 'tx'
        save(n, stream, labels, 'statistics.traffic.mgmt_tx.bytes', 'statistics_traffic')

        if (_.has(n, 'statistics.wireless')) {
          if (Array.isArray(n.statistics.wireless)) {
            for (let freq_index in n.statistics.wireless) {
              labels['mtype'] = 'airtime' + n.statistics.wireless[freq_index].frequency.toString().substring(0, 1)
              for (let airtime_type in n.statistics.wireless[freq_index]) {
                if (airtime_type != 'frequency') {
                  labels['type'] = airtime_type
                  save(n, stream, labels, 'statistics.wireless.[' + freq_index + '].' + airtime_type, 'statistics_airtime')
                }
              }
            }
          }
        }
      }

      counter.traffic.forward += get(n, 'statistics.traffic.forward.bytes')
      counter.traffic.rx += get(n, 'statistics.traffic.rx.bytes')
      counter.traffic.tx += get(n, 'statistics.traffic.tx.bytes')
      counter.traffic.mgmt.rx += get(n, 'statistics.traffic.mgmt_rx.bytes')
      counter.traffic.mgmt.tx += get(n, 'statistics.traffic.mgmt_tx.bytes')

      if (_.has(n, 'neighbours.batadv') && isOnline(n, 'neighbours'))
        for (let mac in n.neighbours.batadv)
          nodeTable[mac] = k

      finished1()
    }, function() {
      async.forEachOf(data, function(n, k, finished2) {
        if (_.has(n, 'neighbours.batadv') && isOnline(n, 'neighbours')) {
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
                  + '",source_name="' + source_name + '",target_name="' + target_name
                  + '",link_type="' + typeTable[dest]  + '"} ' + tq + '\n')
              }
          }
        }
        finished2()
      }, function() {
        stream.write('meshnodes_total ' + counter.meshnodes.total + '\n')
        stream.write('meshnodes_online_total ' + counter.meshnodes.online + '\n')
        stream.write('total_clients ' + counter.clients + '\n')

        var labels = {}

        labels['mtype'] = 'user'
        labels['type'] = 'forward'
        save(counter, stream, labels, 'traffic.forward', 'total_traffic')
        labels['type'] = 'rx'
        save(counter, stream, labels, 'traffic.rx', 'total_traffic')
        labels['type'] = 'tx'
        save(counter, stream, labels, 'traffic.tx', 'total_traffic')

        labels['mtype'] = 'mgmt'
        labels['type'] = 'rx'
        save(counter, stream, labels, 'traffic.mgmt.rx', 'total_traffic')
        labels['type'] = 'tx'
        save(counter, stream, labels, 'traffic.mgmt.tx', 'total_traffic')

        stream.end()
      })
    })
  }

  return {
    /* eslint-disable quotes */
    "metrics": getMetrics
  }
}
