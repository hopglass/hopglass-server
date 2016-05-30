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

  //Named nodes.zone
  function getZone(stream, query) {
    stream.writeHead(200, { 'Content-Type': 'text/plain' })
    var data = receiver.getData(query)

    function get(n, what) {
      if (_.has(n, what))
        return _.get(n, what)
      else
        return 0
    }
    String.prototype.padRight = function(l,c) {return this+Array(l-this.length+1).join(c||" ")}

    var origin = "nodes.ffm.freifunk.net"
    var dnssrv = "ns.ffm.freifunk.net"
    var mailad = "admin@ffm.freifunk.net"
    var mapurl = "https://hopglass.ffm.freifunk.net/"
    
    stream.write('$ORIGIN' + " " + origin + '.\n')
    stream.write('$TTL 86400' + '\n\n')
    stream.write('@ IN SOA ' + dnssrv + '. ' + mailad.replace("@", ".") + '. (\n')
    stream.write('1463764501           ; serial number\n')
    stream.write('28800                ; Refresh\n')
    stream.write('7200                 ; Retry\n')
    stream.write('864000               ; Expire\n')
    stream.write('86400                ; Min TTL\n')
    stream.write(')\n')
    stream.write('@ IN NS ' + dnssrv + '.\n\n')

    var address  = ""
    var hostname = ""
    var nodeid   = ""
    async.forEachOf(data, function(n, k, finished1) {
      if (_.has(n, 'nodeinfo.network.addresses')) {
        address = _.get(n, 'nodeinfo.network.addresses')[1]
        nodeid  = _.get(n, 'nodeinfo.node_id')
        stream.write(nodeid.padRight(30," ") + ' IN AAAA ' + address + '\n')
        stream.write(nodeid.padRight(30," ") + ' IN TXT  "' + mapurl + "/#!v:g;n:" + nodeid + '"\n')
        if (_.has(n, 'nodeinfo.hostname')) {
          hostname = _.get(n, 'nodeinfo.hostname')
          stream.write(hostname.padRight(30," ") + ' IN AAAA ' + address + '\n') 
          stream.write(hostname.padRight(30," ") + ' IN TXT  "' + mapurl + "/#!v:g;n:" + nodeid + '"\n')
        }
        stream.write('\n')
      }
    })
  }

  return {
    /* eslint-disable quotes */
    "nodes.zone": getZone
  }
}
