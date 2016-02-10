# hopglass-server
The HopGlass Server collects data from Freifunk networks and processes it to be used in [HopGlass](https://github.com/plumpudding/hopglass), for statistics and other purposes.

How to use
----------

Setup is easy:

1. Be sure to have nodejs and npm installed
2. Install dependencies:
   `npm install`
3. Start the server:
   `node hopglass.js [args]`

The following arguments can be supplied:

|Argument          |Default       |Description|
|------------------|--------------|---|
|webip             |:: and 0.0.0.0|webserver listen ip address
|webport           |4000          |webserver port|
|iface             |bat0          |the interface to discover nodes on|
|ifaces            |bat0          |a comma-seperated list of interfaces to discover nodes on|
|nodeinfointerval  |180           |interval for nodeinfo queries (in seconds, low values can impact mesh performance)|
|statisticsinterval|60            |interval for statistics and neighbourinfo queries (in seconds, low values can impact mesh performance)|
|collectorport     |45123         |the port the data collector listens on|
|targetip          |ff02::2       |IPv6 (usually multicast group) to query|
|targetport        |1001          |the port to query the nodes on|

Possible webserver queries
--------------------------

|Query Location|Description|
|--------------|---|
|/nodes.json   |Meshviewer nodes.json v2|
|/graph.json   |Meshviewer graph.json v1|
|/raw.json     |raw data collected, same as the `raw.json` save file|
|/hosts        |hosts file|
|/metrics      |Prometheus metrics (currently gluon-collector-style, might change)|

Metrics values
--------------

per node (all with labels `hostname` and `nodeid`):

- statistics.clients.total
- statistics.uptime
- statistics.traffic.rx.bytes
- statistics.traffic.mgmt_rx.bytes
- statistics.traffic.tx.bytes
- statistics.traffic.mgmt_tx.bytes
- statistics.traffic.forward.bytes
- statistics.loadavg
- statistics.memory_usage

total values:

- meshnodes_total
- meshnodes_online_total
- total_clients
- total_traffic_rx
- total_traffic_mgmt_rx
- total_traffic_tx
- total_traffic_mgmt_tx
- total_traffic_forward
