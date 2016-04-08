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

var fs = require('fs')
var _ = require('lodash')

//start with default config
var config = {
  "core": {
    "storage": {
      "interval": 60000,
      "file": "./raw.json"
    }
  },
  "receiver": {
    "announced": {
      "target": {
        "ip": "ff02::1",
        "port": 1001
      },
      "port": 45123,
      "interval": {
        "statistics": 60,
        "nodeinfo": 500
      }
    },
    "ifaces": [
      "bat0",
      "enp4s0"
    ]
  },
  "provider": {
    "hopglass": {
      "offlineTime": 900
    }
  },
  "webserver": {
    "ip": "::",
    "port": 4000
  }
}

var argv = require('minimist')(process.argv.slice(2))

var confFileSpecified = _.has(argv, 'config')
argv.config = _.get(argv, 'config', './config.json')

//read config file sync
try {
  var configFile = JSON.parse(fs.readFileSync(argv.config, 'utf8'))

  if (_.has(configFile, 'receiver.ifaces'))
    config.receiver.ifaces = undefined

  _.merge(config, configFile)
  console.log("successfully parsed config file '" + argv.config + "'")
} catch (err) {
  if (confFileSpecified)
    throw err
  else
    console.log("config file '" + argv.config + "' doesn't exist, using defaults")
}

confFileSpecified = undefined
argv = undefined

var aliases = {}
var receiver
var provider

fs.readFile(config.core.storage.file, 'utf8', function(err, res) {
  var raw
  if (!err)
    raw = JSON.parse(res)
  else
    raw = {}
  fs.readFile('./aliases.json', 'utf8', function(err, res) {
    if (!err)
      aliases = JSON.parse(res)
    init(raw)
  })
})

function getData() {
  return _.merge({}, receiver.announced.getRaw(), aliases)
}

function backupData() {
  provider['hosts'](fs.createWriteStream('hosts'))

  fs.writeFile(config.core.storage.file, JSON.stringify(receiver.announced.getRaw()), function(err) {
    if (err)
      return console.log(err)
  })
}

function init(raw) {
  receiver = require('./modules/receiver')(raw, config.receiver)
  provider = require('./modules/provider')(getData, receiver.announced.getRaw, config.provider)
  require('./modules/webserver')(provider, config.webserver)
  setInterval(backupData, config.core.storage.interval)
}
