'use strict'

// Alfred allows type from 65 up to 255 as general types for client data.
// Alfred-Channel
const ch = {
  nodeinfo:   158,
  statistics: 159,
  neighbours: 160
}
// Data is automatically pruned from the server storage 600s after the last time it was received/refreshed.

function getAlfred(channel, raw, config) {
  var net = require('net')
  var zlib = require('zlib')

  var requestId = Math.floor(Math.random() * (65535 - 0 + 1) + 0)
  var receiveBuffer = Buffer(0)

  try {
    var socket = net.createConnection( config.alfred.socket, function() {
      var requestBuffer = Buffer(7)

      var pos = 0
      requestBuffer.writeUInt8(2, pos);    pos+=1          // Alfred-Header: Type = ALFRED_REQUEST = 2
      requestBuffer.writeUInt8(0, pos);    pos+=1          // Alfred-Header: Version = 0
      requestBuffer.writeUInt16BE(3, pos); pos+=2          // Alfred-Header: Length = Gesamt-Laenge - Header = 3 bytes
      requestBuffer.writeUInt8(channel, pos); pos+=1       // Alfred-Request_v0: request-type
      requestBuffer.writeUInt16BE(requestId, pos); pos+=2  // Alfred-Request_v0: tx_id = random()

      socket.write(requestBuffer)
    })
  } catch (err) {
    console.log(err)
    return
  }

  socket.on('data', function(data) {
    receiveBuffer = Buffer.concat([receiveBuffer, data], receiveBuffer.length + data.length)
  })

  socket.on('end', function() {
    var chunkPos = 0

    while (chunkPos < receiveBuffer.length) {
      var type    = receiveBuffer.readUInt8(chunkPos + 0)
      var version = receiveBuffer.readUInt8(chunkPos + 1)
      var size    = receiveBuffer.readUInt16BE(chunkPos + 2)

      if (type == 4) { // ALFRED_STATUS_ERROR
        console.log("ALFRED_STATUS_ERROR")
        break
      } else if (type != 0) { // !ALFRED_PUSH_DATA
        console.log("unexpected type = " + type);
      } else {
        if (chunkPos + 4 + size > receiveBuffer.length) {
          console.log("buffer overflow!")
          break
        }
        var alfred_transaction_mgmt = receiveBuffer.slice(chunkPos + 4, chunkPos + 4 + size)
        var tx_id = alfred_transaction_mgmt.readUInt16BE(0)
        var seqno = alfred_transaction_mgmt.readUInt16BE(2)
        if (tx_id != requestId) {
          console.log("wrong tx_id!")
          break
        }

        var alfredData = alfred_transaction_mgmt.slice(4)
        var sourceMacBin = alfredData.slice(0, 6)

        var alfredDataHeader  = alfredData.slice(6)
        var alfredDataChannel = alfredDataHeader.readUInt8(0)
        var alfredDataVersion = alfredDataHeader.readUInt8(1)
        var alfredDataSize    = alfredDataHeader.readUInt16BE(2)

        var zippedData = alfredDataHeader.slice(4) // alfred_data + alfred_header
        if (zippedData.length != alfredDataSize) {
          console.log("alfred_data_length mismatch!")
          break
        }

        if (alfredDataChannel != channel) {
          console.log("wrong alfred_channel !")
          break
        }

        try {
          var unzippedData = zlib.unzipSync(zippedData)
          if (unzippedData.length === 0) { // buggy nodes send empty json-data
            console.log("empty data from node! source_mac=" + sourceMacBin.toString('hex') + "; alfred_channel=" + alfredDataChannel);
          } else {
            var obj = JSON.parse(unzippedData)
            var group
            switch (channel) {
              case ch.nodeinfo:   group = "nodeinfo";   break
              case ch.statistics: group = "statistics"; break
              case ch.neighbours: group = "neighbours"; break
            }

            if (typeof obj["node_id"] === 'undefined') {
              console.log("missing node_id!")
            } else {
              var nodeID = obj["node_id"]
              //if (!raw[id]) {
              if (typeof raw[nodeID] === 'undefined') {
                raw[nodeID] = {}
                raw[nodeID].firstseen = new Date().toISOString()
              }
              raw[nodeID][group] = obj
              raw[nodeID].lastseen = new Date().toISOString()
            }
          }
      } catch (err) {
        console.log(err)
      }
    }
    chunkPos += size + 4
  }

  if (chunkPos != receiveBuffer.length) {
      console.log("length mismatch!")
  }

  })
}

//// Quelle: alfred-json/src/main.c und alfred-json/src/packet.h
//// Quelle: https://www.open-mesh.org/projects/alfred/wiki/Alfred_architecture#Request-data

module.exports = function(raw, config) {
  if (config.alfred && config.alfred.enabled && config.alfred.socket) { // BUG: please make it pretty

    getAlfred(ch.nodeinfo, raw, config)
    setTimeout(function() {getAlfred(ch.statistics, raw, config), 500})
    setTimeout(function() {getAlfred(ch.neighbours, raw, config), 1000})

    setInterval(function() {
      getAlfred(ch.nodeinfo, raw, config)
    }, config.alfred.interval.nodeinfo * 1000)

    setTimeout(function() { // Interval-Offset to prevent parallel requests to alfred
      setInterval(function() {
        getAlfred(ch.statistics, raw, config)
        setTimeout(function() {getAlfred(ch.neighbours, raw, config), 500})
      }, config.alfred.interval.statistics * 1000)
    }, 1500)

  }
  function getRaw() {
    return raw
  }

  var exports = {}
  exports.getRaw = getRaw

  return exports
}

