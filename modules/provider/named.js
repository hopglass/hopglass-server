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
  //"mapTemplate": "https://map.community.freifunk.net/#!v:g;n:{node_id}",
  "origin": "nodes.community.freifunk.net.",
  "defaultTtl": 86400,
  "ns": "ns1.community.freifunk.net.",
  "postmaster": "admin+community.freifunk.net.",
  "refresh": 28800,
  "retry": 7200,
  "expire": 864000,
  "minTtl": 86400,
  "nameservers": [
    "ns1.community.freifunk.net.",
    "ns2.community.freifunk.net."
  ],
  //"subdomainNet": [
  //    "fd2b:a015:20bd::/48",
  //    "fd4c:1f09:efca::/48"
  //],
  "namePadding" : 40
}

module.exports = function(receiver, sharedConfig) {
  _.merge(config, sharedConfig.named)
  
  //Named nodes.zone
  function getZone(stream, query) {
    stream.writeHead(200, { 'Content-Type': 'text/plain' })
    var data = receiver.getData(query)

    function namedString(s) {
      if (s == null) {
        return ""
      }
      //limit length
      var r = s.substring(0,50)
      //remove leading and trailing minus
      r = r.replace(/^-+/,'').replace(/-+$/,'')
      //remove non alphanumerics and make lc
      r = r.replace(/-+/g,'_').replace(/_+/g,'_')
      r = r.replace(/\W/g, '').toLowerCase()
      //no underscores and no dots
      r = r.replace(/_+/g,'-').replace(/\.+/g,'-')
      // padding
      var l = config.namePadding
      if (r.length > l) {
        return r
      } else {
        return r+Array(l-r.length+1).join(" "||" ")
      }
    }

    stream.write('$ORIGIN' + " " + config.origin + '\n')
    stream.write('$TTL ' + config.minTtl + '\n\n')
    stream.write('@ IN SOA ' + config.ns + ' ' + config.postmaster.replace("@", "+") + ' (\n')
    stream.write(' ' + Math.round(Date.now() / 1000) + ' ; serial number\n')
    stream.write(' ' + config.refresh + ' ; Refresh\n')
    stream.write(' ' + config.retry + ' ; Retry\n')
    stream.write(' ' + config.expire + ' ; Expire\n')
    stream.write(' ' + config.minTtl + ' ; Min TTL\n')
    stream.write(')\n')
    for (var ns in config.nameservers) { 
      stream.write('@ IN NS ' + config.nameservers[ns] + '\n')
    }
    stream.write('\n')

    var subdomainNets = []
    if (config.subdomainNet) {
      for (var sd in config.subdomainNet) {
        var v = config.subdomainNet[sd]
        var mask = 3 //assume /48 subnet
        if (v.indexOf("/") > 0) {
          //rudimentary way of dealing with subnets
          mask = Math.floor(v.split("/")[1]/16)
        }
        var snet = v.split(":").slice(0,mask).join(":")
        subdomainNets.push(snet)
      }
    } else {
      // match everything if not subnets are specified
      subdomainNets.push("")
    }
    
    async.forEachOf(data, function(n, k, finished) {

      function save(name) {
        if (name == null) {
          return
        }
        if (_.has(n, 'nodeinfo.network.addresses')) {
          var addrobj = _.get(n, 'nodeinfo.network.addresses')
          for (var a in addrobj) {
            var address = addrobj[a]
            for (var s in subdomainNets) {
              if (addrobj[a].indexOf(subdomainNets[s]) === 0) {
                stream.write(namedString(name) + ' IN AAAA ' + address + '\n')
              }
            }
          }
        }    
        if (config.mapTemplate) {
          var mapurl = config.mapTemplate.replace("{node_id}",nodeid)
          stream.write(namedString(name) + ' IN TXT  "' + mapurl + '"\n')
        }
      }

      var nodeid  = _.get(n, 'nodeinfo.node_id')
      save(nodeid)
      if (_.has(n, 'nodeinfo.hostname')) {
        var hostname = _.get(n, 'nodeinfo.hostname')
        if (hostname !== nodeid) {
          save(hostname)
        }
      }
      stream.write('\n')
      finished()
    }, function() {
      stream.end()
    })
    stream.end()
  }

  return {
    /* eslint-disable quotes */
    "nodes.zone": getZone
  }
}

