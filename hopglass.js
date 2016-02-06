var dgram = require('dgram')
var collector = dgram.createSocket('udp6')
var zlib = require('zlib')
var http = require('http')
var fs = require('fs')
var async = require('async')

var argv = require('minimist')(process.argv.slice(2))

var nodeinfoInterval = argv.nodeinfoInterval ? argv.nodeinfoInterval : 180
var statisticsInterval = argv.statisticsInterval ? argv.statisticsInterval : 60
var collectorport = argv.collectorport ? argv.collectorport : 45123
var webport = argv.webport ? argv.webport : 4000
var ifaces = argv.ifaces ? argv.ifaces.split(",") : [argv.iface ? argv.iface : 'bat0']
var targetip = argv.targetip ? argv.targetip : 'ff02::1'
var targetport = argv.targetport ? argv.targetport : 1001

fs.readFile('./data.json', 'utf8', (err, res) => {
  if (err) {
    console.log(err)
    nodes = {}
  } else {
    nodes = JSON.parse(res)
  }
  startCollector()
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

      if (!nodes[id]) {
        nodes[id] = {}
        nodes[id].firstseen = new Date().toISOString()
      }

      if (obj.nodeinfo)
        nodes[id].nodeinfo = obj.nodeinfo
      else if (obj.statistics)
        nodes[id].statistics = obj.statistics
      else if (obj.neighbours)
        nodes[id].neighbours = obj.neighbours
      nodes[id].lastseen = new Date().toISOString()
      if (obj.statistics || obj.neighbours && !nodes[id].nodeinfo) {
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
  fs.writeFile('data.json', JSON.stringify(nodes), (err) => {
    if (err)
      return console.log(err)
  })

  getHosts(fs.createWriteStream('hosts'))
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
  else if (req.url == '/metrics')
    getMetrics(stream)
  else if (req.url == '/raw.json') {
    stream.write(JSON.stringify(nodes))
    stream.end()
  } else if (req.url == '/hosts')
    getHosts(stream)
})

function getHosts(stream) {
  async.forEachOf(nodes, (n,k,callback1) => {
    if (n.nodeinfo) {
      hostname = n.nodeinfo.hostname.toLowerCase().replace(/[^0-9a-z-_]/g,'')
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
  return false
}

function getNodesJson(stream) {
  njson = {}
  njson.version = 2
  njson.nodes = []
  njson.timestamp = new Date().toISOString()
  async.forEachOf(nodes, (n, k, loopCallback) => {
    if (n.nodeinfo) {
      node = {}
      node.nodeinfo = n.nodeinfo
      node.flags = {}
      node.flags.gateway = false
      node.flags.online = isOnline(n)
      node.statistics = {}
      if (n.statistics) {
        node.flags.uplink = parsePeerGroup(n.statistics.mesh_vpn)
        node.statistics.uptime = n.statistics.uptime
        node.statistics.gateway = n.statistics.gateway
        node.statistics.memory_usage = (n.statistics.memory.total - n.statistics.memory.free)/n.statistics.memory.total
        node.statistics.rootfs_usage = n.statistics.rootfs_usage
        node.statistics.clients = n.statistics.clients.total
        node.statistics.loadavg = n.statistics.loadavg
      } else {
        node.statistics.uptime = 0
        node.statistics.memory_usage = 0
        node.statistics.rootfs_usage = 0
        node.statistics.clients = 0
        node.statistics.loadavg = 0
      }
      node.lastseen = n.lastseen
      node.firstseen = n.firstseen
        njson.nodes.push(node)
    }
    loopCallback()
  }, () => {
    stream.write(JSON.stringify(njson))
    stream.end()
  })
}

function isOnline(node) {
  return Math.abs(new Date(node.lastseen) - new Date()) < nodeinfoInterval * 3000
}

function getGraphJson(stream) {
  gjson = {}
  gjson.timestamp = new Date().toISOString()
  gjson.version = 1
  gjson.batadv = {}
  gjson.batadv.multigraph = false
  gjson.batadv.directed = false
  gjson.batadv.nodes = []
  gjson.batadv.links = []
  gjson.batadv.graph = null
  nodetable = {}
  counter = 0
  async.forEachOf(nodes, (n, k, callback1) => {
    if (n.neighbours && isOnline(n)) {
      nodeentry = {}
      nodeentry.node_id = n.neighbours.node_id
      for (mac in n.neighbours.batadv) {
        nodeentry.id = mac
        nodetable[mac] = counter
      }
      gjson.batadv.nodes.push(nodeentry)
      counter++
    }
    callback1()
  }, () => {
    async.forEachOf(nodes, (n, k, callback2) => {
      if (n.neighbours && isOnline(n)) {
        for (src in n.neighbours.batadv) {
          for (dest in n.neighbours.batadv[src].neighbours) {
            link = {}
            link.source = nodetable[src]
            link.target = nodetable[dest]
            link.tq = 255 / n.neighbours.batadv[src].neighbours[dest].tq
            link.bidirect = false
            link.vpn = false
            if (link.source && link.target)
            gjson.batadv.links.push(link)
          }
        }
      }
      callback2()
    }, () => {
      stream.write(JSON.stringify(gjson))
      stream.end()
    })
  })
}

//Prometheus metrics

function getMetrics(stream) {
  counter_meshnodes_online_total = 0
  counter_total_traffic_rx = 0
  counter_total_traffic_mgmt_rx = 0
  counter_total_traffic_tx = 0
  counter_total_traffic_mgmt_tx = 0
  counter_total_traffic_forward = 0
  counter_total_clients = 0
  async.forEachOf(nodes, (n, k, loopCallback) => {
    if (n.nodeinfo && isOnline(n)) {
      counter_meshnodes_online_total++
      if(n.statistics) {
        stream.write('meshnode_clients{hostname="' + n.nodeinfo.hostname + '",nodeid="' + n.nodeinfo.node_id + '"} ' + n.statistics.clients.total + '\n')
        stream.write('meshnode_uptime{hostname="' + n.nodeinfo.hostname + '",nodeid="' + n.nodeinfo.node_id + '"} ' + n.statistics.uptime + '\n')
        stream.write('meshnode_traffic_rx{type="traffic",hostname="' + n.nodeinfo.hostname + '",nodeid="' + n.nodeinfo.node_id + '"} ' + n.statistics.traffic.rx.bytes + '\n')
        stream.write('meshnode_traffic_rx{type="mgmt_traffic",hostname="' + n.nodeinfo.hostname + '",nodeid="' + n.nodeinfo.node_id + '"} ' + n.statistics.traffic.mgmt_rx.bytes + '\n')
        stream.write('meshnode_traffic_tx{type="traffic",hostname="' + n.nodeinfo.hostname + '",nodeid="' + n.nodeinfo.node_id + '"} ' + n.statistics.traffic.tx.bytes + '\n')
        stream.write('meshnode_traffic_tx{type="mgmt_traffic",hostname="' + n.nodeinfo.hostname + '",nodeid="' + n.nodeinfo.node_id + '"} ' + n.statistics.traffic.mgmt_tx.bytes + '\n')
        stream.write('meshnode_traffic_forward{hostname="' + n.nodeinfo.hostname + '",nodeid="' + n.nodeinfo.node_id + '"} ' + n.statistics.traffic.forward.bytes + '\n')
        counter_total_traffic_rx += n.statistics.traffic.rx.bytes
        counter_total_traffic_mgmt_rx += n.statistics.traffic.mgmt_rx.bytes
        counter_total_traffic_tx += n.statistics.traffic.tx.bytes
        counter_total_traffic_mgmt_tx += n.statistics.traffic.mgmt_tx.bytes
        counter_total_traffic_forward += n.statistics.traffic.forward.bytes
        counter_total_clients += n.statistics.clients.total
      }
    }
    loopCallback()
  }, () => {
    stream.write('meshnodes_total ' + Object.keys(nodes).length + '\n')
    stream.write('meshnodes_online_total ' + counter_meshnodes_online_total + '\n')
    stream.write('total_clients ' + counter_total_clients + '\n')
    stream.write('total_traffic_rx ' + counter_total_traffic_rx + '\n')
    stream.write('total_traffic_mgmt_rx ' + counter_total_traffic_mgmt_rx + '\n')
    stream.write('total_traffic_tx ' + counter_total_traffic_tx + '\n')
    stream.write('total_traffic_mgmt_tx ' + counter_total_traffic_mgmt_tx + '\n')
    stream.write('total_traffic_forward ' + counter_total_traffic_forward + '\n')
    stream.end()
  })
}

/////////////////////
// start webserver //
/////////////////////
 
web.listen(webport, () => {
  console.log('webserver listening on port ' + webport)
})

