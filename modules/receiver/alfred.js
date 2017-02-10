/*  Copyright (C) 2017 Linus Broich
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

/*  Hacky alfred receiver v 0.1,
    uses alfred-json for now ;) 
    See: https://github.com/ffnord/alfred-json */
'use strict'

var exec = require('sync-exec');
var _ = require('lodash')

var config = {
  /* eslint-disable quotes */
  "alfred_json": "/usr/bin/alfred-json",
  "sockets": [
    "/var/run/alfred-bat0.sock"
  ],
  "interval": {
    "statistics": 60,
    "nodeinfo": 500
  }
}

delete require.cache[__filename]

module.exports = function(receiverId, configData, api) {
  _.merge(config, configData)
  
  function retrieve(stat) {
    var type
    if (stat == 'nodeinfo') {
      type = 158
    } else if (stat == 'statistics') {
      type = 159
    } else if (stat == 'neighbours') {
      type = 160
    } else return
    config.sockets.forEach(function(socket) {
      /* We should read the data directly from the socket instead of using alfred-json...*/
      var result = exec(config.alfred_json + ' -zr ' + type + ' -s ' + socket)
      var jsondata = JSON.parse(result.stdout)
      Object.keys(jsondata).forEach(function(key) {
        var obj = {}
        obj[stat] = jsondata[key]
        var id = obj[stat].node_id
        api.receiverCallback(id, obj, receiverId)
      })
    })
  }
  
  console.log('Hacky alfred receiver starting...')
  retrieve('nodeinfo')
  retrieve('neighbours')
  retrieve('statistics')

  setInterval(function() {
    retrieve('nodeinfo')
  }, config.interval.nodeinfo * 1000)

  setInterval(function() {
    retrieve('neighbours')
    retrieve('statistics')
  }, config.interval.statistics * 1000)
}