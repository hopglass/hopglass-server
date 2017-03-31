# HopGlass Server
The HopGlass Server collects data from Freifunk networks and processes it to be used in [HopGlass](https://github.com/hopglass/hopglass), for statistics and other purposes.

**Warning: The HopGlass Server is subject to major changes. Updates may require manual intervention.**

## How to use

**ArchLinux or Debian-based systems using systemd (preferred)**

**i.e. Debian Jessie or newer, Ubuntu 15.04 or newer**

1. Run `# wget https://raw.githubusercontent.com/hopglass/hopglass-server/v0.1.3/scripts/bootstrap.sh; bash bootstrap.sh; rm bootstrap.sh`
2. Review and edit the default configuration located at `/etc/hopglass-server/default/config.json`.
3. Start the HopGlass Server: `# systemctl start hopglass-server@default`
4. (Optional) Automatically start the HopGlass Server at boot: `# systemctl enable hopglass-server@default`

Possible webserver queries
--------------------------

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

## Installation without systemd

**Debian-based systems without systemd**

i.e. Debian Wheezy or older, Ubuntu 14.10 or older

***Warning: untested, unsupported, not recommended***

1. Run `# wget https://raw.githubusercontent.com/hopglass/hopglass-server/v0.1.3/scripts/bootstrap.sh; bash bootstrap.sh; rm bootstrap.sh`
2. `INSTALL_DIR="/opt/hopglass/"; cp "$INSTALL_DIR"/server/config.json.example /etc/hopglass-server/default/config.json;
    chown -R hopglass:hopglass /etc/hopglass-server`
3. `cp server/aliases.json.example server/aliases.json`
4. `echo "{}">server/raw.json`
5. Create a start script in `/usr/local/bin/` similar to this:
   `su - hopglass --shell /bin/bash -c "cd server; node hopglass-server.js --config /etc/hopglass-server/default/config.json"`
6. Create an init-script in `/etc/init.d/`.

## After installation

You might want to
- Install a webserver (search for Nginx or Apache) and configure a reverse proxy and gzip-compression
- Install [HopGlass](https://github.com/hopglass/hopglass)
- Install [Prometheus](http://prometheus.io/) and [Grafana](http://grafana.org/)
