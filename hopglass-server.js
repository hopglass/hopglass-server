#!/usr/bin/node
'use strict'

var fs = require('fs')
var _ = require('lodash')

var argv = require('minimist')(process.argv.slice(2))

if (argv.config)
  fs.readFile(argv.config, 'utf8', (err, res) => {
    if (err)
      throw err
    else
      argv = JSON.parse(res)
  })

var config = {}
config.nodeinfoInterval = _.get(argv, 'nodeinfoInterval', 180)
config.statisticsInterval = _.get(argv, 'statisticsInterval', 60)
config.collectorport = _.get(argv, 'collectorport', 45123)
config.webip = _.get(argv, 'webip', '::')
config.webport = _.get(argv, 'webport', 4000)
config.ifaces = argv.ifaces ? argv.ifaces.split(',') : _.get(argv, 'iface', 'bat0')
config.targetip = _.get(argv, 'targetip', 'ff02::1')
config.targetport = _.get(argv, 'targetport', 1001)

argv = undefined

var aliases = {}
var collector
var webserver

fs.readFile('./raw.json', 'utf8', (err, res) => {
  if (!err)
    var raw = JSON.parse(res)
  fs.readFile('./aliases.json', 'utf8', (err, res) => {
    if (!err)
      aliases = JSON.parse(res)
    init(raw, aliases)
  })
})

function getData() {
  return _.merge({}, collector.getRaw(), aliases)
}

function backupData() {
  getHosts(fs.createWriteStream('hosts'))

  fs.writeFile('raw.json', JSON.stringify(announced.getRaw()), (err) => {
    if (err)
      return console.log(err)
  })
}

function init(raw, readAliases) {
  aliases = readAliases
  collector = require('./modules/receiver/announced')(raw, config)
  var index = {}
  _.merge(index, require('./modules/provider/hopglass')(getData, config))
  webserver = require('./modules/webserver')(index, config)
  setInterval(backupData, 60000)
}
