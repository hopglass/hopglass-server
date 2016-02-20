var dgram = require('dgram')
var collector = dgram.createSocket('udp6')
var zlib = require('zlib')
var http = require('http')
var fs = require('fs')
var async = require('async')
var _ = require('lodash')

var argv = require('minimist')(process.argv.slice(2))

var nodeinfoInterval = argv.nodeinfoInterval ? argv.nodeinfoInterval : 180
var statisticsInterval = argv.statisticsInterval ? argv.statisticsInterval : 60
var collectorport = argv.collectorport ? argv.collectorport : 45123
var webport = argv.webport ? argv.webport : 4000
var ifaces = argv.ifaces ? argv.ifaces.split(",") : [argv.iface ? argv.iface : 'bat0']
var targetip = argv.targetip ? argv.targetip : 'ff02::1'
var targetport = argv.targetport ? argv.targetport : 1001

raw = {}
aliases = {}

function getData() {
  return _.merge({}, raw, aliases)
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

/////////////////////
// collector stuff //
/////////////////////

collector.on('error', (err) => {
  console.log(`collector error:\n${err.stack}`)
  collector.close()
})

collector.on('message', (msg, rinfo) => {
  zlib.inflateRaw(msg, (err,res) => {
    if (err) {
      console.log('ERR: ' + err)
    } else {
      obj = JSON.parse(res)
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
  ip = address ? address : targetip
  req = new Buffer('GET ' + stat)
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

/////////////////////
// start collector //
/////////////////////

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

/////////////////////
// webserver stuff //
/////////////////////

var web = http.createServer((req, stream) => {
  stream.setHeader('Access-Control-Allow-Origin', '*')
  stream.writeHead(200, { 'Content-Type': 'text/json' })
  if (req.url == '/nodes.json')
    getNodesJson(stream)
  else if (req.url == '/graph.json')
    getGraphJson(stream)
  else if (req.url == '/nodelist.json')
    getNodelistJson(stream)
  else if (req.url == '/ffmap.json')
    getFfmapJson(stream)
  else if (req.url == '/metrics')
    getMetrics(stream)
  else if (req.url == '/hosts')
    getHosts(stream)
  else if (req.url == '/raw.json') {
    stream.write(JSON.stringify(raw))
    stream.end()
  } else if (req.url == '/data.json') {
    stream.write(JSON.stringify(data))
    stream.end()
  } else {
    stream.write('404')
    stream.end()
  }
})

function getHosts(stream) {
  data = getData()
  async.forEachOf(data, (n, k, callback1) => {
    if (_.has(n, 'nodeinfo.hostname')) {
      hostname = _.get(n, 'nodeinfo.hostname', 'unknown').toLowerCase().replace(/[^0-9a-z-_]/g,'')
      async.forEachOf(n.nodeinfo.network.addresses, (a,l,callback2) => {
        if (a.slice(0,4) != 'fe80')
          stream.write((a + ' ' + hostname) + '\n')
        callback2()
      }, callback1)
    } else
      callback1()
  }, (err) => {
    stream.end()
  })
}

//MV jsons

function parsePeerGroup(pg) {
  for (i in pg) {
    if (i == 'peers') {
      for (j in pg[i]) {
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
  data = getData()
  nJson = {}
  nJson.version = 2
  nJson.nodes = []
  nJson.timestamp = new Date().toISOString()
  async.forEachOf(data, (n, k, loopCallback) => {
    if (n.nodeinfo) {
      node = {}
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
      node.statistics.loadavg = _.get(n, 'statistics.loadavg', 0)
      node.lastseen = _.get(n, 'firstseen', new Date().toISOString())
      node.firstseen = _.get(n, 'firstseen', new Date().toISOString())
      nJson.nodes.push(node)
    }
    loopCallback()
  }, () => {
    stream.write(JSON.stringify(nJson))
    stream.end()
  })
}

function isOnline(node) {
  return Math.abs((node.lastseen ? new Date(node.lastseen) : new Date()) - new Date()) < nodeinfoInterval * 3000
}

function getGraphJson(stream) {
  data = getData()
  gJson = {}
  gJson.timestamp = new Date().toISOString()
  gJson.version = 1
  gJson.batadv = {}
  gJson.batadv.multigraph = false
  gJson.batadv.directed = true
  gJson.batadv.nodes = []
  gJson.batadv.links = []
  gJson.batadv.graph = null
  nodeTable = {}
  typeTable = {}
  counter = 0
  async.forEachOf(data, (n, k, callback1) => {
    if (_.has(n, 'neighbours.batadv') && isOnline(n)) {
      nodeentry = {}
      nodeentry.node_id = k
      for (mac in n.neighbours.batadv) {
        nodeentry.id = mac
        nodeTable[mac] = counter
      }
      gJson.batadv.nodes.push(nodeentry)
      counter++
    }
    if (_.has(n, 'nodeinfo.network.mesh'))
      for (bat in n.nodeinfo.network.mesh) {
        for (type in n.nodeinfo.network.mesh[bat].interfaces) {
          n.nodeinfo.network.mesh[bat].interfaces[type].forEach((d) => {
            typeTable[d] = type
          })
        }
      }
    callback1()
  }, () => {
    async.forEachOf(data, (n, k, callback2) => {
      if (_.has(n, 'neighbours.batadv') && isOnline(n)) {
        for (dest in n.neighbours.batadv) {
          if (_.has(n.neighbours.batadv[dest], 'neighbours'))
            for (src in n.neighbours.batadv[dest].neighbours) {
              link = {}
              link.source = nodeTable[src]
              link.target = nodeTable[dest]
              tq = n.neighbours.batadv[dest].neighbours[src].tq
              link.tq = 255 / (tq ? tq : 1)
              link.type = typeTable[dest]
              if (!isNaN(link.source) && !isNaN(link.target))
                gJson.batadv.links.push(link)
            }
        }
      }
      callback2()
    }, () => {
      stream.write(JSON.stringify(gJson))
      stream.end()
    })
  })
}

//nodelist.json (yet another format)
function getNodelistJson(stream) {
  data = getData()
  nl = {}
  nl.version = "1.0.0"
  nl.updated_at = new Date().toISOString()
  nl.nodes = []
  async.forEachOf(data, (n, k, callback) => {
    node = {}
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
    callback()
  }, () => {
    stream.write(JSON.stringify(nl))
    stream.end()
  })
}

//ffmap-d3
function getFfmapJson(stream) {
  data = getData()
  ffmapJson = {}
  ffmapJson.meta = {}
  ffmapJson.meta.timestamp = new Date().toISOString().slice(0, 19)
  ffmapJson.nodes = []
  ffmapJson.links = []
  nodeTable = {}
  typeTable = {}
  counter = 0
  async.forEachOf(data, (n, k, callback1) => {
    node = {}
    node.id = _.get(n, 'nodeinfo.network.mac')
    node.name = _.get(n, 'nodeinfo.hostname')
    node.flags = {"gateway": false, "online": isOnline(n)}
    node.clientcount = _.get(n, 'statistics.clients.total', 0)
    node.firmware = _.get(n, 'nodeinfo.software.firmware.release')
    if (_.has(n, 'nodeinfo.location.latitude') && _.has(n, 'nodeinfo.location.longitude')) {
      node.geo = []
      node.geo.push(_.get(n, 'nodeinfo.location.latitude', 0))
      node.geo.push(_.get(n, 'nodeinfo.location.longitude', 0))
    } else
      node.geo = null
    if (_.has(n, 'neighbours.batadv') && isOnline(n))
      for (mac in n.neighbours.batadv) {
        nodeTable[mac] = counter
      }
    if (_.has(n, 'nodeinfo.network.mesh'))
      for (bat in n.nodeinfo.network.mesh) {
        for (type in n.nodeinfo.network.mesh[bat].interfaces) {
          n.nodeinfo.network.mesh[bat].interfaces[type].forEach((d) => {
            typeTable[d] = type
          })
        }
      }
    ffmapJson.nodes.push(node)
    counter++
    callback1()
  }, () => {
    async.forEachOf(data, (n, k, callback2) => {
      if (_.has(n, 'neighbours.batadv') && isOnline(n)) {
        for (dest in n.neighbours.batadv) {
          if (_.has(n.neighbours.batadv[dest], 'neighbours'))
            for (src in n.neighbours.batadv[dest].neighbours) {
              link = {}
              link.source = nodeTable[src]
              link.target = nodeTable[dest]
              tq = n.neighbours.batadv[dest].neighbours[src].tq
              link.quality = (255 / (tq ? tq : 1)) + ", " + (255 / (tq ? tq : 1))
              link.type = typeTable[dest] === "tunnel" ? "vpn" : null
              link.id = src + "-" + dest
              if (!isNaN(link.source) && !isNaN(link.target))
                ffmapJson.links.push(link)
            }
        }
      }
      callback2()
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
  data = getData()
  save = (n, id, stream, what, where) => {
    if (_.has(n, what))
      stream.write((where ? where : what.replace(/\./g, '_')) + id + ' ' +  _.get(n, what) + '\n')
  }
  get = (n, what) => {
    if (_.has(n, what))
      return _.get(n, what)
    else
      return 0;
  }
  counter_meshnodes_online_total = 0
  counter_traffic_rx = 0
  counter_traffic_mgmt_rx = 0
  counter_traffic_tx = 0
  counter_traffic_mgmt_tx = 0
  counter_traffic_forward = 0
  counter_clients = 0
  async.forEachOf(data, (n, k, loopCallback) => {
    if (isOnline(n)) {
      counter_meshnodes_online_total++
      if (_.has(n, 'nodeinfo.hostname') && isOnline(n)) {
        id = '{hostname="' + n.nodeinfo.hostname + '",nodeid="' + k + '"}'
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
    loopCallback()
  }, () => {
    stream.write('meshnodes_total ' + Object.keys(data).length + '\n')
    stream.write('meshnodes_online_total ' + counter_meshnodes_online_total + '\n')
    stream.write('total_clients ' + counter_clients + '\n')
    stream.write('total_traffic_rx ' + counter_traffic_rx + '\n')
    stream.write('total_traffic_mgmt_rx ' + counter_traffic_mgmt_rx + '\n')
    stream.write('total_traffic_tx ' + counter_traffic_tx + '\n')
    stream.write('total_traffic_mgmt_tx ' + counter_traffic_mgmt_tx + '\n')
    stream.write('total_traffic_forward ' + counter_traffic_forward + '\n')
    stream.end()
  })
}

/////////////////////
// start webserver //
/////////////////////
 
web.listen(webport, () => {
  console.log('webserver listening on port ' + webport)
})

