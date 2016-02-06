# hopglass-server
The HopGlass Server collects data from Freifunk networks and processes it to be used in [HopGlass](https://github.com/plumpudding/hopglass), for statistics and other purposes.

How to use
----------

Setup is easy:
1. Be sure to have nodejs and npm installed
2. Install dependencies: `npm install`
3. Start the server: `node hopglass.js [args]`

The following arguments can be supplied:

|Argument           |Default|Description|
|-------------------|-------|---|
|webport           |4000   |webserver port|
|iface             |bat0   |the interface to discover nodes on|
|nodeinfointerval  |180    |interval for nodeinfo queries (in seconds, low values can impact mesh performance)|
|statisticsinterval|60     |interval for statistics and neighbourinfo queries (in seconds, low values can impact mesh performance)|
|collectorport     |45123  |the port the data collector listens on|
|targetip          |ff02::2|IPv6 (usually multicast group) to query|
|targetport        |1001   |the port to query the nodes on|

Possible webserver queries
--------------------------

|Query Location|Description|
|--------------|---|
|/nodes.json   |Meshviewer nodes.json v2|
|/graph.json   |Meshviewer graph.json v1|
|/hosts        |hosts file|
|/metrics      |Prometheus metrics (currently gluon-collector-style, might change)|
