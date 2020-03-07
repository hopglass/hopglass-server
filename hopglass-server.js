#!/usr/bin/node

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

const fs = require('fs')
const _ = require('lodash')
const hjson = require('hjson')

//start with default config
const config = {
  /* eslint-disable quotes */
  "core": { },
  "receiver": { },
  "provider": { },
  "webserver": { },
  "observer": { }
}

let argv = require('minimist')(process.argv.slice(2))

const configPath = _.get(argv, 'config', './config.json')

//read config file sync
try {
  const configFile = hjson.parse(fs.readFileSync(configPath, 'utf8'))

  if (_.has(configFile, 'receiver.ifaces'))
    config.receiver.ifaces = undefined

  _.merge(config, configFile)
  console.info('successfully parsed config file "' + configPath + '"')
} catch (err) {
  console.warn('config file "' + argv.config + '" doesn\'t exist, using defaults')
}

argv = undefined

const observer = require('./modules/observer')(config.observer)
const receiver = require('./modules/receiver')(observer, config.receiver)
const provider = require('./modules/provider')(receiver, config.provider)
require('./modules/webserver')(provider, config.webserver)
