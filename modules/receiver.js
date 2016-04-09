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

module.exports = function (raw, config) {
  var exports = {}

  //var announced = require('./receiver/announced')(raw, config)
  //var alfred = require('./receiver/alfred')(raw, config)

  var announced = require('./receiver/announced')({}, config)
  var alfred = require('./receiver/alfred')({}, config)

  function getRaw() {
    return alfred.getRaw()
  }

  var exports = {}

  exports.getRaw = getRaw
  return exports
}
