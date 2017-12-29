#!/usr/bin/node
'use strict'

var _ = require('lodash')
var fs = require('fs')
var async = require('async')

var argv = require('minimist')(process.argv.slice(2))

argv.file    = _.get(argv, 'file', './raw.json')
argv.type    = _.get(argv, 'type', false)
argv.value   = _.get(argv, 'value', false)
argv.quiet   = _.get(argv, 'quiet', false)
argv.quiet   = _.get(argv, 'q', false)
argv.inverse = _.get(argv, 'inverse', false)

if (argv['?'] || argv.help || !(_.isString(argv.type) && argv.value))
  outputHelp()

argv.value = _.toString(argv.value).split(',')

var now = (new Date()).getTime()
var count = {total: 0, removed: 0}

fs.readFile(argv.file, 'utf8', function(err, res) {
  if (err)
    throw(err)

  var raw = JSON.parse(res)

  async.forEachOfSeries(raw, function(node, id, callback) {
    count.total++
    filter(node, function(res, err) {
      if (res ^ argv.inverse) {
        count.removed++
        if (!argv.quiet)
          console.log('  remove ' + _.get(node, 'nodeinfo.node_id') + '(' + _.get(node, 'nodeinfo.hostname') + ')')
        raw[id] = undefined
      }
      if (err)
        return callback(err)
      else
        callback()
    })
  }, function(error) {
    if (error)
      return console.error(error)

    fs.writeFile(argv.file + '.purged', JSON.stringify(raw), function(err) {
      if (err)
        throw(err)

      if (!argv.quiet)
        console.log('removed ' + count.removed + '/' + count.total)
    })
  })
})

function filter(node, callback) {
  var out = false
  async.forEachOfSeries(argv.value, function(element, index, finished) {

    switch (argv.type) {
    case 'site':
      if (_.get(node, 'nodeinfo.system.site_code', element) == element)
        out = true
      break
    case 'node':
      if (_.get(node, 'nodeinfo.node_id', element) == element)
        out = true
      break
    case 'offline':
      var lastseen = (new Date(_.get(node, 'lastseen', 0))).getTime()
      var v = _.toNumber(element)*86400*1000
      if (now - lastseen >= v)
        out = true
      break
    default:
      return callback(false, 'unknown type \'' + argv.type + '\'\n')
    }

    finished()
  }, function() {
    callback(out)
  })
}

function outputHelp() {
  var out = ''
  var ln = function(content) { out += (content ? ' ' + content : '') + '\n' }

  ln()
  ln('Usage: ./purgeRaw.js <options>')
  ln()
  ln('Options:')
  ln('  --file <filepath>    [opt.] default: ./raw.json')
  ln('  --quiet, -q          [opt.] default: false')
  ln('  --inverse            [opt.] default: false')
  ln('  --help, -?           [opt.] displays this help')
  ln('  --type <type>        [req.]')
  ln('  --value <value>      [req.] single value or multiple comma separated values')
  ln()
  ln('<type>:')
  ln('  site         remove nodes with defined sitecode')
  ln('  node         remove nodes with defined nodeid')
  ln('  offline      remove nodes, older than defined days')
  ln()

  console.info(out)
  process.exit()
}
