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

var config = {
  /* eslint-disable quotes */
  "origin":       "nodes.community.freifunk.net.",
  "defaultTtl":   86400,
  "ns":           "ns1.community.freifunk.net.",
  "postmaster":   "admin+community.freifunk.net.",
  "refresh":      28800,
  "retry":        7200,
  "expire":       864000,
  "minTtl":       86400,
  "nameservers":  [
    "ns1.community.freifunk.net.",
    "ns2.community.freifunk.net."
  ],
  "subdomainNet": "fddd:5d16:b5dd:0::/64",
  "namePadding" : 40
}

module.exports = function(receiver, configData) {
  _.merge(config, configData)
  
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
    String.prototype.padRight = function(l,c) {
      if (this.length > l) {
        return this
      } else {
        return this+Array(l-this.length+1).join(c||" ")
      }
    }

    stream.write('$ORIGIN' + " " + config.origin + '\n')
    stream.write('$TTL ' + config.minTtl + '\n\n')
    stream.write('@ IN SOA ' + config.ns + ' ' + config.postmaster.replace("@", "+") + ' (\n')
    stream.write(' ' + Date.now() + '       ; serial number\n')
    stream.write(' ' + config.refresh + ' ; Refresh\n')
    stream.write(' ' + config.retry + '   ; Retry\n')
    stream.write(' ' + config.expire + '  ; Expire\n')
    stream.write(' ' + config.minTtl + ' ; Min TTL\n')
    stream.write(')\n')
    for (var ns in config.nameservers) { 
      stream.write('@ IN NS ' + config.nameservers[ns] + '\n')
    }
    stream.write('\n')

    var subdomain = config.subdomainNet.split(":").slice(0,2).join(":")
    
    async.forEachOf(data, function(n, k, finished1) {
      if (_.has(n, 'nodeinfo.network.addresses')) {
        var addrobj = _.get(n, 'nodeinfo.network.addresses')
        var address = undefined
        for (var a in addrobj) {
          if (addrobj[a].indexOf(subdomain) === 0) {
            address = addrobj[a]
          }
        }
        if (address) {
          var padding = config.namePadding
          var nodeid  = _.get(n, 'nodeinfo.node_id')
          stream.write(nodeid.padRight(padding," ") + ' IN AAAA ' + address + '\n')
          if (config.mapTemplate) {
            var mapurl = config.mapTemplate.replace("{node_id}",nodeid)
            stream.write(nodeid.padRight(padding," ") + ' IN TXT  "' + mapurl + '"\n')
          }
          if (_.has(n, 'nodeinfo.hostname')) {
            var hostname = _.get(n, 'nodeinfo.hostname')
            stream.write(hostname.padRight(padding," ") + ' IN AAAA ' + address + '\n') 
            if (config.mapTemplate) {
              stream.write(hostname.padRight(padding," ") + ' IN TXT  "' + mapurl + '"\n')
            }
          }
          stream.write('\n')
        }
      }
    })
    stream.end()
  }

  return {
    /* eslint-disable quotes */
    "nodes.zone": getZone
  }
}
