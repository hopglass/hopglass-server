const dgram = require('dgram')
const collector = dgram.createSocket('udp6')
const zlib = require('zlib')
const http = require('http')
const fs = require('fs')

var argv = require('minimist')(process.argv.slice(2));
console.log(argv)

var nodeinfointerval = argv.nodeinfointerval ? argv.nodeinfointerval : 180
var statisticsinterval = argv.statisticsinterval ? argv.statisticsinterval : 60
var collectorport = argv.collectorport ? argv.collectorport : 45123
var webport = argv.webport ? argv.webport : 4000
var iface = argv.iface ? argv.iface : 'bat0'
var targetip = argv.targetip ? argv.targetip : 'ff02::2'
var targetport = argv.targetport ? argv.targetport : 1001

fs.readFile("./data.json", 'utf8', (err, res) => {
  if(err) {
    console.log(err)
    nodes = {}
  } else {
    nodes = JSON.parse(res)
  }
  startCollector()
});

/////////////////////
// collector stuff //
/////////////////////

collector.on('error', (err) => {
  console.log(`collector error:\n${err.stack}`)
  collector.close()
})

collector.on('message', (msg, rinfo) => {
  zlib.inflateRaw(msg, (err,res) => {
    if(err) {
      console.log('ERR: ' + err)
    } else {
      obj = JSON.parse(res)
      if(obj.nodeinfo) {
        id = obj.nodeinfo.node_id
      } else if(obj.statistics) {
        id = obj.statistics.node_id
      } else if(obj.neighbours) {
        id = obj.neighbours.node_id
      } else return

      if(!nodes[id]) {
        nodes[id] = {}
        nodes[id].firstseen = new Date().toISOString()
      }

      if(obj.nodeinfo)
        nodes[id].nodeinfo = obj.nodeinfo
      else if(obj.statistics)
        nodes[id].statistics = obj.statistics
      else if(obj.neighbours)
        nodes[id].neighbours = obj.neighbours
      nodes[id].lastseen = new Date().toISOString()
      if(obj.statistics || obj.neighbours && !nodes[id].nodeinfo) {
        req = new Buffer('GET nodeinfo')
        collector.send(req, 0, req.length, rinfo.port, rinfo.address)
      }
    }
  })
})

function retrieve(stat) {
  req = new Buffer('GET ' + stat)
  collector.send(req, 0, req.length, targetport, targetip + '%' + iface)
}

function backupData() {
  fs.writeFile("data.json", JSON.stringify(nodes), function(err) {
    if(err)
        return console.log(err)
  })
  fs.writeFile("hosts", getHosts())
}

/////////////////////
// start collector //
/////////////////////

function startCollector() {
  collector.bind(collectorport)
  
  retrieve('nodeinfo statistics neighbours')
  setInterval(() => {
    retrieve('nodeinfo')
  },nodeinfointerval * 1000)
  
  setInterval(() => {
    retrieve('statistics neighbours')
  },statisticsinterval * 1000)
  
  setInterval(() => {
    backupData()
  }, 60000)
}

/////////////////////
// webserver stuff //
/////////////////////

var web = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.writeHead(200, { 'Content-Type': 'text/json' })
  if(req.url=='/nodes.json')
    res.write(getNodesJson())
  else if(req.url=='/graph.json')
    res.write(getGraphJson())
  else if(req.url=='/metrics')
    res.write(getMetrics())
  else if(req.url=='/raw.json')
    res.write(JSON.stringify(nodes))
  else if(req.url=='/hosts')
    res.write(getHosts())
  res.end()
})

function getHosts() {
  res = ''
  for (k in nodes) {
    n = nodes[k]
    if(n.nodeinfo) {
      hostname = n.nodeinfo.hostname.toLowerCase().replace(/[^0-9a-z-_]/g,'')
      n.nodeinfo.network.addresses.forEach((a) => {
        if(a.slice(0,4) != "fe80")
          res += (a + ' ' + hostname) + '\n'
      })
    }
  }
  return res
}

//MV jsons

function parsePeerGroup(pg) {
  for (i in pg) {
    if(i == 'peers') {
      for (j in pg[i]) {
        if(pg[i][j])
          return true
      }
    } else {
      if(parsePeerGroup(pg[i]))
        return true
    }
  }
  return false
}

function getNodesJson() {
  njson = {}
  njson.version = 2
  njson.nodes = []
  for (k in nodes) {
    n = nodes[k]
    node = {}
    node.nodeinfo = n.nodeinfo
    node.flags = {}
    node.flags.gateway = false
    node.flags.online = isOnline(n)
    node.flags.uplink = parsePeerGroup(n.statistics.mesh_vpn)
    node.statistics = {}
    if(n.statistics) {
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
    if(n.nodeinfo)
      njson.nodes.push(node)
  }
  njson.timestamp = new Date().toISOString()
  return JSON.stringify(njson)
}

function isOnline(node) {
  return Math.abs(new Date(node.lastseen) - new Date()) < nodeinfointerval * 3000
}

function getGraphJson() {
  gjson = {}
  gjson.version = 1
  gjson.batadv = {}
  gjson.batadv.multigraph = false
  gjson.batadv.directed = false
  gjson.batadv.nodes = []
  nodetable = {}
  counter = 0
  for (k in nodes) {
    n = nodes[k]
    if(n.neighbours && isOnline(n)) {
      nodeentry = {}
      nodeentry.node_id = n.neighbours.node_id
      for (mac in n.neighbours.batadv) {
        nodeentry.id = mac
        nodetable[mac] = counter
      }
      gjson.batadv.nodes.push(nodeentry)
      counter++
    }
  }
  gjson.batadv.links = []
  for (k in nodes) {
    n = nodes[k]
    if(n.neighbours && isOnline(n)) {
      for (src in n.neighbours.batadv) {
        for (dest in n.neighbours.batadv[src].neighbours) {
          link = {}
          link.source = nodetable[src]
          link.target = nodetable[dest]
          link.tq = 255 / n.neighbours.batadv[src].neighbours[dest].tq
          link.bidirect = false
          link.vpn = false
          if(link.source && link.target)
          gjson.batadv.links.push(link)
        }
      }
    }
  }
  gjson.batadv.graph = null
  gjson.timestamp = new Date().toISOString()
  return JSON.stringify(gjson)
}

//Prometheus metrics

function getMetrics() {
  res = ''
  counter_meshnodes_online_total = 0
  counter_total_traffic_rx = 0
  counter_total_traffic_mgmt_rx = 0
  counter_total_traffic_tx = 0
  counter_total_traffic_mgmt_tx = 0
  counter_total_traffic_forward = 0
  counter_total_clients = 0
  for (k in nodes) {
    n = nodes[k]
    if(n.nodeinfo && isOnline(n)) {
      res += 'meshnode_clients{hostname="' + n.nodeinfo.hostname + '",nodeid="' + n.nodeinfo.node_id + '"} ' + n.statistics.clients.total + '\n'
      res += 'meshnode_uptime{hostname="' + n.nodeinfo.hostname + '",nodeid="' + n.nodeinfo.node_id + '"} ' + n.statistics.uptime + '\n'
      res += 'meshnode_traffic_rx{type="traffic",hostname="' + n.nodeinfo.hostname + '",nodeid="' + n.nodeinfo.node_id + '"} ' + n.statistics.traffic.rx.bytes + '\n'
      res += 'meshnode_traffic_rx{type="mgmt_traffic",hostname="' + n.nodeinfo.hostname + '",nodeid="' + n.nodeinfo.node_id + '"} ' + n.statistics.traffic.mgmt_rx.bytes + '\n'
      res += 'meshnode_traffic_tx{type="traffic",hostname="' + n.nodeinfo.hostname + '",nodeid="' + n.nodeinfo.node_id + '"} ' + n.statistics.traffic.tx.bytes + '\n'
      res += 'meshnode_traffic_tx{type="mgmt_traffic",hostname="' + n.nodeinfo.hostname + '",nodeid="' + n.nodeinfo.node_id + '"} ' + n.statistics.traffic.mgmt_tx.bytes + '\n'
      res += 'meshnode_traffic_forward{hostname="' + n.nodeinfo.hostname + '",nodeid="' + n.nodeinfo.node_id + '"} ' + n.statistics.traffic.forward.bytes + '\n'
      counter_meshnodes_online_total++
      counter_total_traffic_rx += n.statistics.traffic.rx.bytes
      counter_total_traffic_mgmt_tx += n.statistics.traffic.mgmt_tx.bytes
      counter_total_traffic_rx += n.statistics.traffic.rx.bytes
      counter_total_traffic_mgmt_tx += n.statistics.traffic.mgmt_tx.bytes
      counter_total_traffic_forward += n.statistics.traffic.forward.bytes
      counter_total_clients += n.statistics.clients.total
    }
  }
  res += 'meshnodes_total ' + Object.keys(nodes).length + '\n'
  res += 'meshnodes_online_total ' + counter_meshnodes_online_total + '\n'
  res += 'total_clients ' + counter_total_clients + '\n'
  res += 'total_traffic_rx ' + counter_total_traffic_rx + '\n'
  res += 'total_traffic_mgmt_rx ' + counter_total_traffic_mgmt_rx + '\n'
  res += 'total_traffic_tx ' + counter_total_traffic_tx + '\n'
  res += 'total_traffic_mgmt_tx ' + counter_total_traffic_mgmt_tx + '\n'
  res += 'total_traffic_forward ' + counter_total_traffic_forward + '\n'
  return res
}

/////////////////////
// start webserver //
/////////////////////
 
web.listen(webport, () => {
  console.log('webserver listening on port ' + webport)
})

