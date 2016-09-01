#HopGlass Server
The HopGlass Server collects data from Freifunk networks and processes it to be used in [HopGlass](https://github.com/hopglass/hopglass), for statistics and other purposes.

**Warning: The HopGlass Server is subject to major changes. Updates may require manual intervention.**

##How to use

**ArchLinux or Debian-based systems using systemd (preferred)**

**i.e. Debian Jessie or newer, Ubuntu 15.04 or newer**

1. Run `# wget https://raw.githubusercontent.com/hopglass/hopglass-server/v0.1.1/scripts/bootstrap.sh; bash bootstrap.sh; rm bootstrap.sh`  
   (NOTE: If you don't used nodejs on your server, it will be fine to install it as it is, otherwise comment out the `prereq` call at the end of the script and do the needed steps manually.)  
  `bash bootstrap.sh` will automatically process these steps:
  - install the server in a folder of your choice (by default: `/opt/hopglass`)
  - `apt-get install apt-transport-https curl git lsb-release`
  - `apt-get remove nodejs nodejs-legacy npm`
  - Install **NodeJS 6** from external repositories from `https://deb.nodesource.com/node_6.x $DISTRO` via `/etc/apt/sources.list.d/nodesource.list`
  - `apt-get install nodejs git`
  - `adduser --system --home=$INSTALL_DIR --group hopglass`
  - As user `hopglass`:
    - `git clone https://github.com/hopglass/hopglass-server -b v0.1.1 server; cd server`
    - `npm install`
  - Symlink systemd service and copy config files to:
    - `/etc/hopglass-server/default/config.json`
    - `/lib/systemd/system/hopglass-server@.service`
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
|/raw.json              |Raw data collected, same as the `raw.json` save file|
|/hosts                 |hosts file to be placed in /etc/hosts|
|/metrics               |Prometheus metrics|
|/wifi-aliases.txt      |Aliases file for Wifi Analyzer app|
|/WifiAnalyzer_Alias.txt|Aliases file for Wifi Analyzer app|
|/ffapi.json            |Freifunk API file|
|/nodes.zone            |Named DNS zone file|

##Metrics values

###per node (all with the labels `hostname`, `nodeid` and `gateway`):

- statistics.clients.total
- statistics.uptime
- statistics.traffic
- statistics.loadavg
- statistics.memory_usage

###total values:

- meshnodes_total
- meshnodes_online_total
- total_clients
- total_traffic

##Development timeline

**oldmaster (maintenance)**

**v0.1.1 (current)**

- fully modular conversion system
- many bugfixes
- meshviewer provider
- ffapi provider
- label-based traffic metrics

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

##Installation without systemd

**Debian-based systems without systemd**

i.e. Debian Wheezy or older, Ubuntu 14.10 or older

***Warning: untested, unsupported, not recommended***

1. Run `# wget https://raw.githubusercontent.com/hopglass/hopglass-server/v0.1.1/scripts/bootstrap.sh; bash bootstrap.sh; rm bootstrap.sh`
2. Create a start script in `/usr/local/bin/` similar to this:
   `su - hopglass --shell /bin/bash -c "cd server; node hopglass-server.js --config /etc/hopglass-server/$1/config.json"`
3. Create an init-script in `/etc/init.d/`.

##After installation

You might want to
- Install a webserver (search for Nginx or Apache) and configure a reverse proxy and gzip-compression
- Install [HopGlass](https://github.com/hopglass/hopglass)
- Install [Prometheus](http://prometheus.io/) and [Grafana](http://grafana.org/)
