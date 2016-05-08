#!/usr/bin/node
'use strict'

var dgram = require('dgram')
var collector = dgram.createSocket('udp6')
var zlib = require('zlib')
var http = require('http')
var fs = require('fs')
var async = require('async')
var _ = require('lodash')

var argv = require('minimist')(process.argv.slice(2))

if (argv.config)
  fs.readFile(argv.config, 'utf8', (err, res) => {
    if (err)
      throw err
    else
      argv = JSON.parse(res)
  })

var nodeinfoInterval = argv.nodeinfoInterval ? argv.nodeinfoInterval : 180
var statisticsInterval = argv.statisticsInterval ? argv.statisticsInterval : 60
var collectorport = argv.collectorport ? argv.collectorport : 45123
var webip = argv.webip ? argv.webip : '::'
var webport = argv.webport ? argv.webport : 4000
var ifaces = argv.ifaces ? argv.ifaces.split(',') : [argv.iface ? argv.iface : 'bat0']
var targetip = argv.targetip ? argv.targetip : 'ff02::1'
var targetport = argv.targetport ? argv.targetport : 1001

argv = undefined

var raw = {}
var aliases = {}
var data = {}

function getData() {
  data = _.merge({}, raw, aliases)
}

fs.readFile('./raw.json', 'utf8', (err, res) => {
  if (!err)
    raw = JSON.parse(res)
  fs.readFile('./aliases.json', 'utf8', (err, res) => {
    if (!err)
      aliases = JSON.parse(res)
    startCollector()
  })
})

//collector callbacks

collector.on('error', (err) => {
  console.log(`collector error:\n${err.stack}`)
  collector.close()
  process.exit(1)
})

collector.on('listening', () => {
  console.log('collector listening on port ' + collectorport)
})

collector.on('message', (msg, rinfo) => {
  zlib.inflateRaw(msg, (err,res) => {
    if (err) {
      console.log('ERR: ' + err)
    } else {
      var obj = JSON.parse(res)
      var id
      if (obj.nodeinfo) {
        id = obj.nodeinfo.node_id
      } else if (obj.statistics) {
        id = obj.statistics.node_id
      } else if (obj.neighbours) {
        id = obj.neighbours.node_id
      } else return

      if (!raw[id]) {
        raw[id] = {}
        raw[id].firstseen = new Date().toISOString()
      }

      if (obj.nodeinfo)
        raw[id].nodeinfo = obj.nodeinfo
      else if (obj.statistics)
        raw[id].statistics = obj.statistics
      else if (obj.neighbours)
        raw[id].neighbours = obj.neighbours
      raw[id].lastseen = new Date().toISOString()
      if (obj.statistics || obj.neighbours && !raw[id].nodeinfo) {
        retrieve('nodeinfo', rinfo.address)
      }
    }
  })
})

function retrieve(stat, address) {
  var ip = address ? address : targetip
  var req = new Buffer('GET ' + stat)
  ifaces.forEach((iface) => {
    collector.send(req, 0, req.length, targetport, ip + '%' + iface)
  })
}

function backupData() {
  getHosts(fs.createWriteStream('hosts'))

  fs.writeFile('raw.json', JSON.stringify(raw), (err) => {
    if (err)
      return console.log(err)
  })
}

//start collector

function startCollector() {
  collector.bind(collectorport)
  
  retrieve('nodeinfo')
  retrieve('neighbours')
  retrieve('statistics')

  setInterval(() => {
    retrieve('nodeinfo')
  },nodeinfoInterval * 1000)
  
  setInterval(() => {
    retrieve('neighbours')
    retrieve('statistics')
  },statisticsInterval * 1000)
  
  setInterval(() => {
    backupData()
  }, 60000)
}

//webserver

var web = http.createServer((req, stream) => {
  stream.setHeader('Access-Control-Allow-Origin', '*')
  switch (req.url) {
    case '/nodes.json':
      stream.writeHead(200, { 'Content-Type': 'application/json' })
      getNodesJson(stream)
      break
    case '/graph.json':
      stream.writeHead(200, { 'Content-Type': 'application/json' })
      getGraphJson(stream)
      break
    case '/nodelist.json':
      stream.writeHead(200, { 'Content-Type': 'application/json' })
      getNodelistJson(stream)
      break
    case '/ffmap.json':
      stream.writeHead(200, { 'Content-Type': 'application/json' })
      getFfmapJson(stream)
      break
    case '/metrics':
      stream.writeHead(200, { 'Content-Type': 'text/plain' })
      getMetrics(stream)
      break
    case '/hosts':
      stream.writeHead(200, { 'Content-Type': 'text/plain' })
      getHosts(stream)
      break
    case '/wifi-aliases.txt':
      stream.writeHead(200, { 'Content-Type': 'text/plain' })
      getWifiAliases(stream)
      break
    case '/raw.json':
      stream.writeHead(200, { 'Content-Type': 'application/json' })
      stream.write(JSON.stringify(raw))
      stream.end()
      break
    case '/data.json':
      stream.writeHead(200, { 'Content-Type': 'application/json' })
      stream.write(JSON.stringify(data))
      stream.end()
      break
    default:
      stream.writeHead(404, { 'Content-Type': 'text/plain' })
      stream.write('404')
      stream.end()
  }
})

function getHosts(stream) {
  getData()
  async.forEachOf(data, (n, k, finished1) => {
    if (_.has(n, 'nodeinfo.hostname')) {
      var hostname = _.get(n, 'nodeinfo.hostname', 'unknown').toLowerCase().replace(/[^0-9a-z-_]/g,'')
      async.forEachOf(n.nodeinfo.network.addresses, (a,l,finished2) => {
        if (a.slice(0,4) != 'fe80')
          stream.write((a + ' ' + hostname) + '\n')
        finished2()
      }, finished1)
    } else
      finished1()
  }, (err) => {
    stream.end()
  })
}

function getWifiAliases(stream) {
  getData()
  function write(mac, hostname, primaryMac) {
    stream.write(mac + '|' + hostname + ' (' + primaryMac + ')\n')
  }
  function getAPMac(mac, offset) {
    //thanks to pixelistik
    var parts = mac.split(":").map((d) => {
      return parseInt(d, 16)
    })

    parts[0] = parts[0] + 2 % 255
    parts[1] = parts[1] + 2 % 255
    parts[2] = parts[2] + offset % 255

    return parts.map((d) => {
      var i = d.toString(16)
      return ("0" + i).substr(i.length-1)
    }).join(":")
  }
  stream.write('# WifiAnalyzer Alias-Include\n')
  stream.write('# ' + new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '') + '\n')
  async.forEachOf(_.filter(data, 'nodeinfo.network.mac'), (n, k, finished1) => {
    var hostname = _.get(n, 'nodeinfo.hostname', 'unknown')
    var mac = _.get(n, 'nodeinfo.network.mac')
    write(getAPMac(mac, 1), hostname, mac)
    write(getAPMac(mac, 2), hostname + " (5GHz)", mac)
    finished1()
  }, () => {
    stream.end()
  })
}

//Hopglass jsons

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
  getData()
  var nJson = {}
  nJson.version = 2
  nJson.nodes = []
  nJson.timestamp = new Date().toISOString()
  async.forEachOf(data, (n, k, finished) => {
    if (n.nodeinfo) {
      var node = {}
      node.nodeinfo = _.get(n, 'nodeinfo', {})
      node.flags = {}
      node.flags.gateway = _.get(n, 'flags.gateway')
      node.flags.online = isOnline(n)
      node.statistics = {}
      node.flags.uplink = parsePeerGroup(_.get(n, 'statistics.mesh_vpn'))
      node.statistics.uptime = _.get(n, 'statistics.uptime')
      node.statistics.gateway = _.get(n, 'statistics.gateway')
      if(_.has(n, 'statistics.memory'))
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
  }, () => {
    stream.write(JSON.stringify(nJson))
    stream.end()
  })
}

function isOnline(node) {
  if (node)
    return Math.abs((node.lastseen ? new Date(node.lastseen) : new Date()) - new Date()) < nodeinfoInterval * 5000
  else
    return true
}

function getGraphJson(stream) {
  getData()
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
  async.forEachOf(data, (n, k, finished1) => {
    if (_.has(n, 'neighbours.batadv') && _.has(n, 'nodeinfo.network.mac'))
      for (let mac in n.neighbours.batadv) {
        macTable[mac] = k
      }
    if (_.has(n, 'nodeinfo.network.mesh'))
      for (let bat in n.nodeinfo.network.mesh) {
        for (let type in n.nodeinfo.network.mesh[bat].interfaces) {
          n.nodeinfo.network.mesh[bat].interfaces[type].forEach((d) => {
            typeTable[d] = type
          })
        }
      }
    finished1()
  }, () => {
    async.forEachOf(data, (n, k, finished2) => {
      if (_.has(n, 'neighbours.batadv') && isOnline(n)) {
        for (let dest in n.neighbours.batadv) {
          if (_.has(n.neighbours.batadv[dest], 'neighbours'))
            for (let src in n.neighbours.batadv[dest].neighbours) {
              var link = {}
              link.source = nodeTable[src]
              link.target = nodeTable[dest]
              var tq = _.get(n, ['neighbours', 'batadv', dest, 'neighbours', src, 'tq'])
              link.tq = 255 / (tq ? tq : 1)

              if (typeTable[src] === 'l2tp')
                link.type = 'l2tp'
              else if (typeTable[dest] === 'tunnel')
                link.type = 'fastd'
              else
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
    }, () => {
      stream.write(JSON.stringify(gJson))
      stream.end()
    })
  })
}

//nodelist.json (yet another format)

function getNodelistJson(stream) {
  getData()
  var nl = {}
  nl.version = '1.0.0'
  nl.updated_at = new Date().toISOString()
  nl.nodes = []
  async.forEachOf(data, (n, k, finished) => {
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
  }, () => {
    stream.write(JSON.stringify(nl))
    stream.end()
  })
}

//ffmap-d3

function getFfmapJson(stream) {
  getData()
  var ffmapJson = {}
  ffmapJson.meta = {}
  ffmapJson.meta.timestamp = new Date().toISOString().slice(0, 19)
  ffmapJson.nodes = []
  ffmapJson.links = []
  var nodeTable = {}
  var typeTable = {}
  var counter = 0
  async.forEachOf(data, (n, k, finished1) => {
    var node = {}
    node.id = _.get(n, 'nodeinfo.network.mac')
    node.name = _.get(n, 'nodeinfo.hostname')
    node.flags = {'gateway': false, 'online': isOnline(n)}
    node.clientcount = _.get(n, 'statistics.clients.total', 0)
    node.firmware = _.get(n, 'nodeinfo.software.firmware.release')
    if (_.has(n, 'nodeinfo.location.latitude') && _.has(n, 'nodeinfo.location.longitude')) {
      node.geo = []
      node.geo.push(_.get(n, 'nodeinfo.location.latitude', 0))
      node.geo.push(_.get(n, 'nodeinfo.location.longitude', 0))
    } else
      node.geo = null
    if (_.has(n, 'neighbours.batadv') && isOnline(n))
      for (let mac in n.neighbours.batadv) {
        nodeTable[mac] = counter
      }
    if (_.has(n, 'nodeinfo.network.mesh'))
      for (let bat in n.nodeinfo.network.mesh) {
        for (let type in n.nodeinfo.network.mesh[bat].interfaces) {
          n.nodeinfo.network.mesh[bat].interfaces[type].forEach((d) => {
            typeTable[d] = type
          })
        }
      }
    ffmapJson.nodes.push(node)
    counter++
    finished1()
  }, () => {
    async.forEachOf(data, (n, k, finished2) => {
      if (_.has(n, 'neighbours.batadv') && isOnline(n)) {
        for (let dest in n.neighbours.batadv) {
          if (_.has(n.neighbours.batadv[dest], 'neighbours'))
            for (let src in n.neighbours.batadv[dest].neighbours) {
              var link = {}
              link.source = nodeTable[src]
              link.target = nodeTable[dest]
              var tq = _.get(n, ['neighbours', 'batadv', dest, 'neighbours', src, 'tq'])
              link.quality = (255 / (tq ? tq : 1)) + ', ' + (255 / (tq ? tq : 1))
              link.type = typeTable[dest] === 'tunnel' ? 'vpn' : null
              link.id = src + '-' + dest
              if (!isNaN(link.source) && !isNaN(link.target))
                ffmapJson.links.push(link)
            }
        }
      }
      finished2()
    }, () => {
      ffmapJson.links = _.uniqWith(ffmapJson.links, (a, b) => {
        return ((a.source == b.source && a.target == b.target) ||
                (a.source == b.target && a.target == b.source))
      })
      stream.write(JSON.stringify(ffmapJson))
      stream.end()
    })
  })
}

//Prometheus metrics

function getMetrics(stream) {
  getData()
  var save = (n, stream, labels, what, value) => {
    var id = '{'
    var first = true
    for (var e in labels) {
      if (first)
        first = false
      else
        id += ','
      id += e + '="' + labels[e] + '"'
    }
    id += "}"
    if (!value) {
      if (_.has(n, what))
        value = _.get(n, what)
    }
    stream.write(what.replace(/\./g, '_') + id + ' ' +  value + '\n')
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
  var typeTable = {}
  async.forEachOf(data, (n, k, finished1) => {
    if (_.has(n, 'nodeinfo.network.mesh'))
      for (let bat in n.nodeinfo.network.mesh) {
        for (let type in n.nodeinfo.network.mesh[bat].interfaces) {
          n.nodeinfo.network.mesh[bat].interfaces[type].forEach((d) => {
            typeTable[d] = type
          })
        }
      }
    counter_meshnodes_total++
    if (isOnline(n)) {
      counter_meshnodes_online_total++
      if (_.has(n, 'nodeinfo.hostname') && _.has(n, 'statistics.gateway')) {

        var labels = [];
        labels["hostname"] = _.get(n, 'nodeinfo.hostname',"");
        labels["nodeid"]   = k;
        labels["gateway"]  = _.get(n, 'statistics.gateway');

        save(n, stream, labels, 'statistics.clients.total')
        save(n, stream, labels, 'statistics.uptime')
        save(n, stream, labels, 'statistics.loadavg')
        save(n, stream, labels, 'statistics.rootfs_usage')

        save(n, stream, labels, 'statistics_memory_usage',
             (_.get(n, 'statistics.memory.total') - _.get(n, 'statistics.memory.free')) / _.get(n, 'statistics.memory.total', -1))

        labels["type"] = 'forward'
        save(n, stream, labels, 'statistics.traffic', _.get(n, 'statistics.traffic.forward.bytes'))
        labels["type"] = 'rx'
        save(n, stream, labels, 'statistics.traffic', _.get(n, 'statistics.traffic.rx.bytes'))
        labels["type"] = 'tx'
        save(n, stream, labels, 'statistics.traffic', _.get(n, 'statistics.traffic.tx.bytes'))
        labels["mgmt"] = 'true'
        save(n, stream, labels, 'statistics.traffic', _.get(n, 'statistics.traffic.mgmt_tx.bytes'))
        labels["type"] = 'rx'
        save(n, stream, labels, 'statistics.traffic', _.get(n, 'statistics.traffic.mgmt_rx.bytes'))
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
  }, () => {
    async.forEachOf(data, (n, k, finished2) => {
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
                + '",source_name="' + source_name + '",target_name="' + target_name
                + '",link_type="' + typeTable[dest] + '"} '+ tq + '\n')
            }
        }
      }
      finished2()
    }, () => {
      stream.write('meshnodes_total ' + counter_meshnodes_total + '\n')
      stream.write('meshnodes_online_total ' + counter_meshnodes_online_total + '\n')
      stream.write('total_clients ' + counter_clients + '\n')

      var labels = [];
      labels["type"] = 'forward'
      save(null, stream, labels, 'total_traffic', counter_traffic_forward)
      labels["type"] = 'rx'
      save(null, stream, labels, 'total_traffic', counter_traffic_rx)
      labels["type"] = 'tx'
      save(null, stream, labels, 'total_traffic', counter_traffic_tx)
      labels["mgmt"] = 'true'
      save(null, stream, labels, 'total_traffic', counter_traffic_mgmt_tx)
      labels["type"] = 'rx'
      save(null, stream, labels, 'total_traffic', counter_traffic_mgmt_rx)

      stream.end()
    })
  })
}

//start webserver
 
web.listen(webport, webip, () => {
  console.log('webserver listening on port ' + webport)
})

