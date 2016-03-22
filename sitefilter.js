#!/usr/bin/node
'use strict'

var fs = require('fs')
var a = require('async')
var _ = require('lodash')

var sites = process.argv.slice(2)

if (sites.length == 0)
  console.log('please specify at least one site code to remove')

function filter(node, callback) {
  var ret = false
  a.forEachOf(sites, (site, index, callback2) => {
    if (_.get(node, 'nodeinfo.system.site_code', site) == site)
      ret = true
    callback2()
  }, () => {
    callback(ret)
  })
}

fs.readFile('./raw.json', 'utf8', (err, res) => {
  if (err)
    throw(err)

  var raw = JSON.parse(res)

  a.forEachOf(raw, (node, id, callback) => {
    filter(node, (res) => {
      if (res)
        raw[id] = undefined
      callback()
    })
  }, () => {
    fs.writeFile('raw.json.new', JSON.stringify(raw), (err) => {
      if (err)
        throw(err)
    })
  })
})
