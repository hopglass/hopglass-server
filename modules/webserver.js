'use strict'

var http = require('http')
var _ = require("lodash")

var config = {
  ip: '::',
  port: 4000
}

module.exports = function(index, configData) {
  _.merge(config, configData)

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
  }).listen(config.port, config.ip, () => {
    console.log('webserver listening on port ' + config.port)
  })
}
