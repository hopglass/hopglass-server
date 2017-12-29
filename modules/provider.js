/*  Copyright (C) 2016 Milan Pässler
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

'use strict'

var _ = require('lodash')

var config = {
  /* eslint-disable quotes */
  "offlineTime": 900,
  "metricsOfflineTime": 60,
  "ffapiPath": "./ffapi/"
}

module.exports = function (receiver, configData) {
  _.merge(config, configData)

  var exports = {}

  require('fs').readdirSync(__dirname + '/provider').forEach(function(e) {
    var re = /\.js$/
    if (re.test(e)) {
      try {
        _.merge(exports, require(__dirname + '/provider/' + e)(receiver, config))
      } catch(err) {
        console.err('Error while initializing provider "' + e + '": ', err)
        console.err('Exiting...')
        process.exit(1)
      }
    }
  })

  return exports
}
