#!/usr/bin/node
'use strict'

var fs = require('fs')
var _ = require('lodash')

//start with default config
var config = {
  "core": {
    "backup": {
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
argv.config = _.get(argv, 'config', './config.json')

var exists = false

try {
  var stat = fs.statSync(argv.config)
  exists = stat.isFile()
} catch (err) {}

if (exists) {
  //read config file sync
  try {
    var configFromFile = JSON.parse(fs.readFileSync(argv.config, 'utf8'))
    if (_.has(configFromFile, 'receiver.ifaces'))
      config.receiver.ifaces = undefined
    _.merge(config, configFromFile)
  } catch (err) {
    console.log(err)
    process.exit(1)
  }
  console.log("successfully parsed config file '" + argv.config + "'")
} else {
  console.log("config file '" + argv.config + "' doesn't exist, using defaults")
}

exists = undefined
stat = undefined

var aliases = {}
var receiver
var provider
var webserver

fs.readFile('./raw.json', 'utf8', function(err, res) {
  if (!err)
    var raw = JSON.parse(res)
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

  fs.writeFile(config.core.backup.file, JSON.stringify(receiver.announced.getRaw()), function(err) {
    if (err)
      return console.log(err)
  })
}

function init(raw) {
  receiver  = require('./modules/receiver')(raw, config.receiver)
  provider  = require('./modules/provider')(getData, config.provider)
  webserver = require('./modules/webserver')(provider, config.webserver)
  setInterval(backupData, config.core.backup.interval)
}
