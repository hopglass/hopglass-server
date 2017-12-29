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
  observers: [
  ]
}

module.exports = function (configData) {
  if (configData.observers)
    delete config.observers

  _.merge(config, configData)

  var observerList = []

  for (var i in config.observers) {
    var r = config.observers[i]
    try {
      observerList.push(require(__dirname + '/observer/' + r.module)(r.config))
    } catch(err) {
      console.err('Error while initializing observer "' + configData.observers[i].module + '": ', err)
      console.err('Exiting...')
      process.exit(1)
    }
  }

  function dataReceived(data) {
    for (var i in observerList) {
      try {
        observerList[i].dataReceived(data)
      } catch(err) {
        console.err('Error in observer "' + configData.observers[i].module + '", function dataReceived: ', err)
      }
    }
  }

  var exports = {}
  exports.dataReceived = dataReceived
  return exports
}
