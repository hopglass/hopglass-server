#HopGlass Server
The HopGlass Server collects data from Freifunk networks and processes it to be used in [HopGlass](https://github.com/plumpudding/hopglass), for statistics and other purposes.

##How to use

Setup is easy:

1. Be sure to have a recent version of NodeJS (any version >= 4.x should work) and npm installed
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

##Metrics values

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

##Installation for dummies

This assumes you are running a Debian Jessie (stable) or newer or Ubuntu 14.04 LTS (Trusty Tahr) or newer. 

**Warning: The HopGlass Server is subject to major changes. Updates may require manual intervention.**

###Debian Stretch (testing) or newer / Ubuntu 16.04 or newer

```
#Install NodeJS from distro repositories
sudo -i
apt update
apt install nodejs git

#Create a user
useradd -mU hopglass
su - hopglass

#Clone and install dependencies
git clone https://github.com/plumpudding/hopglass-server
cd hopglass-server
npm install
exit

#Create start script:
echo 'su - hopglass -c "cd hopglass-server; node hopglass-server.js $@"' > /usr/bin/hopglass
```

###Older Ubuntu or Debian Jessie

```
#Install NodeJS
sudo -i
wget -O- https://deb.nodesource.com/gpgkey/nodesource.gpg.key | apt-key add -
echo "deb https://deb.nodesource.com/node_5.x $(lsb_release -c -s) main" > /etc/apt/sources.list.d/nodesource.list
echo "deb-src https://deb.nodesource.com/node_5.x $(lsb_release -c -s) main" >> /etc/apt/sources.list.d/nodesource.list
apt-get update
apt-get install nodejs git

#Create a user
useradd -mU hopglass
su - hopglass

#Clone and install dependencies
git clone https://github.com/plumpudding/hopglass-server
cd hopglass-server
npm install
exit

#Create start script:
echo 'su - hopglass -c "cd hopglass-server; node hopglass-server.js $@"' > /usr/bin/hopglass
```

##After installation

You might want to
- Install a webserver (search for Nginx or Apache) and configure a reverse proxy and gzip-compression
- Install [HopGlass](https://github.com/plumpudding/hopglass)
- Add "`hopglass`"-command to "on up"-section in your fastd-configuration for the server to start automatically.
