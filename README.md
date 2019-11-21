# HopGlass Server
The HopGlass Server collects data from Freifunk networks and processes it to be used in [HopGlass](https://github.com/hopglass/hopglass), for statistics and other purposes.

## How to use

### Installation

1. Install a recent version of NodeJS. It is recommended to use your distribution's package manager: https://nodejs.org/en/download/package-manager/
2. Clone the hopglass-server repository to /opt/hopglass/server
2. Copy the systemd service file to /etc/systemd/system, or create an init-script if your distribution does not support systemd.
3. Start the HopGlass Server: `# systemctl start hopglass-server@default`
4. (Optional) Automatically start the HopGlass Server at boot: `# systemctl enable hopglass-server@default`

### After installation

Ensure, that the ports, you configured in `/etc/hopglass-server/default/config.json` are open in your firewall (default port 1001 UDP and 45123 UDP).

You might want to
- Install a webserver (search for Nginx or Apache) and configure a reverse proxy and gzip-compression
- Install [HopGlass](https://github.com/hopglass/hopglass)
- Install [Prometheus](http://prometheus.io/) and [Grafana](http://grafana.org/)

### Update

**Warning: The HopGlass Server is subject to major changes. Updates may require manual intervention.**

For a start, you can try this:

1. pull

        git pull

1. Copy the new systemd service file to `/etc/systemd/system` or `/lib/systemd/system/` and reload with:

        systemctl daemon-reload

1. check for possible needed changes in the `config.json`

        diff config.json config.json.example

1. rebuild the server:

        npm install

1. restart the service

        service hopglass-server@default restart


## Possible webserver queries

|Query Location         |Description|
|---------------------- |---|
|/nodes.json            |HopGlass nodes.json v2|
|/graph.json            |HopGlass graph.json v1|
|/mv/nodes.json         |Meshviewer nodes.json v2|
|/mv/graph.json         |Meshviewer graph.json v1|
|/mv1/nodes.json        |Meshviewer nodes.json v1|
|/mv1/graph.json        |Meshviewer graph.json v1|
|/raw.json              |Raw data collected, same as the `raw.json` save file|
|/nodelist.json         |nodelist.json format (github.com/ffansbach/nodelist)|
|/hosts                 |hosts file to be placed in /etc/hosts|
|/metrics               |Prometheus metrics|
|/wifi-aliases.txt      |Aliases file for Wifi Analyzer app|
|/WifiAnalyzer_Alias.txt|Aliases file for Wifi Analyzer app|
|/ffapi.json            |Freifunk API file|
|/nodes.zone            |Named DNS zone file|

## Metrics values

### per node (all with the labels `hostname`, `nodeid` and `gateway`):

- statistics.clients.total
- statistics.uptime
- statistics.traffic
- statistics.loadavg
- statistics.memory_usage

### total values:

- meshnodes_total
- meshnodes_online_total
- total_clients
- total_traffic

## Filter / Query's

### Syntax
- [nodes|nodelist].json?filter=[filterName]&value=[filterValue]

### Filternames
- site
- firmware_release
- firstseen
- lastseen
- uptime
- clients
- nodeid

## Development timeline

**oldmaster (outdated)**

**v0.1.0 (outdated)**

- fully modular conversion system
- many bugfixes
- meshviewer provider
- ffapi provider
- label-based traffic metrics

**v0.1.1 (outdated)**

- bugfix release

**v0.1.2 (outdated)**

- many bugfixes (many contributors)
- additional input checks (Joshua1337, eberhab)
- provider/hopglass: resolve gateways to nodeids (mar-v-in)
- provider/hopglass: nexthop key (eberhab)
- new provider: dns zone output (eberhab)
- probably more I forgot

**v0.1.3 (current)**

- fix the install script

**v0.2 (next)**

- provide a graph-generation implementation for all providers
- graph caching
- handle gateway flag correctly without aliases
- alfred receiver

**v0.3**

- new HopGlass data format
- network-transparent receivers

**v1.0**

- definition of the Prometheus metrics format
- definition of the transitional data format
- definition of the configuration format
