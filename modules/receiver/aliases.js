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

const fs = require('fs')
const _ = require('lodash')
const hjson = require('hjson')

const config = {
  /* eslint-disable quotes */
  "file": "./aliases.json"
}

delete require.cache[__filename]

module.exports = function(receiverId, configData, api) {
  _.merge(config, configData)

  let aliases = {}

  if (!fs.existsSync(config.file)) {
    console.log('creating empty %o', config.file)
    fs.writeFileSync(config.file, '{}')
  }

  function doLoad() {
    console.log('reloading %o', config.file)
    try {
      aliases = hjson.parse(fs.readFileSync(config.file, 'utf8'))
    } catch (err) {
      console.warn('couldn\'t read %o - %o - using empty or previous', config.file, String(err))
    }

    _.forEach(aliases, function(n, k) {
      api.receiverCallback(k, n, receiverId)
    })
  }

  doLoad()

  fs.watchFile(config.file, doLoad)
}
