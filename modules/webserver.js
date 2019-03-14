/*  Copyright (C) 2019 Milan Pässler
    Copyright (C) 2019 HopGlass Server contributors

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

var http = require('http')
var _ = require('lodash')

var config = {
  ip: '::',
  port: 4000
}

module.exports = function(index, configData) {
  _.merge(config, configData)

  http.createServer(function(req, stream) {
    stream.setHeader('Access-Control-Allow-Origin', '*')

    var url = require('url').parse(req.url, true) // true to get query as object
    var success = false

    for (let path in index) {
      if (url.pathname == '/' + path) {
        try {
          index[path](stream, url.query)
        } catch(err) {
          console.error('Error while handling request "' + path + '": ', err)
        }
        success = true
      }
    }

    if (!success) {
      stream.writeHead(404, { 'Content-Type': 'text/plain' })
      stream.write('404')
      stream.end()
    }
  }).listen(config.port, config.ip, function() {
    console.log('webserver listening on port ' + config.port)
  })
}
