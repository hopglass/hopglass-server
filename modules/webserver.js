#!/usr/bin/node
'use strict'

var http = require('http')

module.exports = function(index, config) {
  http.createServer(function(req, stream) {
    stream.setHeader('Access-Control-Allow-Origin', '*')

    var success = false

    for (let path in index) {
      if (req.url == '/' + path) {
        index[path](stream)
        success = true
      }
    }

    if (!success) {
      stream.writeHead(404, { 'Content-Type': 'text/plain' })
      stream.write('404')
      stream.end()
    }
  }).listen(config.webport, config.webip, function() {
    console.log('webserver listening on port ' + config.webport)
  })
}
