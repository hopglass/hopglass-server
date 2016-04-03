#!/usr/bin/node
'use strict'

var fs = require('fs')
var _ = require('lodash')

var config = {
  receiver: {},
  provider: {},
  webserver: {}
}

{
  var argv = require('minimist')(process.argv.slice(2))
  argv.config = argv.config ? argv.config : __dirname + "/config.json"

  try { // read config.json syncron
    _.merge(config, JSON.parse(fs.readFileSync(argv.config, 'utf8')))
  } catch (err) {
     console.log(err)
     process.exit(1)
  }
}

var aliases = {}
,   receiver
,   provider
,   webserver

fs.readFile('./raw.json', 'utf8', (err, res) => {
  if (!err)
    var raw = JSON.parse(res)
  fs.readFile('./aliases.json', 'utf8', (err, res) => {
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

  fs.writeFile('raw.json', JSON.stringify(receiver.announced.getRaw()), (err) => {
    if (err)
      return console.log(err)
  })
}

function init(raw) {
  receiver  = require('./modules/receiver')(raw, config.receiver)
  provider  = require('./modules/provider')(getData, config.provider)
  webserver = require('./modules/webserver')(provider, config.webserver)
  setInterval(backupData, 60000)
}
