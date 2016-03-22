#!/usr/bin/node
'use strict'

var fs = require('fs')
var a = require('async')
var _ = require('lodash')

var fsite = process.argv[2]

if (!fsite)
  console.log('please specify a site code to remove')

function isSite(n) {
  return _.get(n, 'nodeinfo.system.site_code', fsite) != fsite
}

fs.readFile('./raw.json', 'utf8', (err, res) => {
  if (err)
    throw(err)

  var raw = JSON.parse(res)
  var fNodes = _.filter(raw, isSite)

  fs.writeFile('raw.json.new', JSON.stringify(fNodes), (err) => {
    if (err)
      throw(err)
  })
})
