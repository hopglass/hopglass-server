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

var fs = require('fs')
var _ = require('lodash')

module.exports = function(receiver, config) {
  function getFFApiJson(stream, query) {
    var data = receiver.getData(query)

    var site = 'all'
    if (query.filter == 'site' && query.value)
      site = query.value

    try {
      var obj = JSON.parse(fs.readFileSync(config.ffapiPath + site + '.json', 'UTF-8'))
    } catch(err) {
      console.log(err)
      stream.writeHead(404, { 'Content-Type': 'text/plain' })
      stream.write('404')
      stream.end()
      return
    }

    _.set(obj, 'state.nodes', Object.keys(data).length)
    _.set(obj, 'state.lastchange', new Date().toISOString())

    stream.writeHead(200, { 'Content-Type': 'application/json' })
    stream.write(JSON.stringify(obj))
    stream.end()
  }

  return {
    /* eslint-disable quotes */
    "ffapi.json": getFFApiJson
  }
}
