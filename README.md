#HopGlass Server
The HopGlass Server collects data from Freifunk networks and processes it to be used in [HopGlass](https://github.com/plumpudding/hopglass), for statistics and other purposes.

**Warning: The HopGlass Server is subject to major changes. Updates may require manual intervention.**

##How to use

**Debian-based systems using systemd (preferred)**

**i.e. Debian Jessie or newer, Ubuntu 15.04 or newer**

1. Run `$ curl -sL https://raw.githubusercontent.com/plumpudding/hopglass-server/master/scripts/bootstrap.sh | sudo -E bash -`
2. Review and edit the default configuration located at `/etc/hopglass-server/default/config.json`.
3. Start the HopGlass Server: `$ sudo systemctl start hopglass-server@default`
4. (Optional) Automatically start the HopGlass Server at boot: `$ sudo systemctl enable hopglass-server@default`

Possible webserver queries
--------------------------

|Query Location         |Description|
|---------------------- |---|
|/nodes.json            |HopGlass nodes.json v2|
|/graph.json            |HopGlass graph.json v1|
|/raw.json              |Raw data collected, same as the `raw.json` save file|
|/hosts                 |hosts file to be placed in /etc/hosts|
|/metrics               |Prometheus metrics|
|/wifi-aliases.txt      |Aliases file for Wifi Analyzer app|
|/WifiAnalyzer_Alias.txt|Aliases file for Wifi Analyzer app|

##Metrics values

###per node (all with the labels `hostname`, `nodeid` and `gateway`):

- statistics.clients.total
- statistics.uptime
- statistics.traffic.rx.bytes
- statistics.traffic.mgmt_rx.bytes
- statistics.traffic.tx.bytes
- statistics.traffic.mgmt_tx.bytes
- statistics.traffic.forward.bytes
- statistics.loadavg
- statistics.memory_usage

###total values:

- meshnodes_total
- meshnodes_online_total
- total_clients
- total_traffic_rx
- total_traffic_mgmt_rx
- total_traffic_tx
- total_traffic_mgmt_tx
- total_traffic_forward

##Manual Installation

**Debian-based systems without systemd with NodeJS 0.10**

**i.e. Debian Wheezy or older, Ubuntu 14.10 or older**

***Warning: untested, unsupported, not recommanded***

1. Go through the installation process:

```
sudo -i
INSTALL_DIR=/opt/hopglass

#Install NodeJS from distro repositories
apt-get update
apt-get install nodejs nodejs-legacy npm git -y

#Create a user
adduser --system --home=$INSTALL_DIR --group hopglass

#Clone and install dependencies
su - hopglass --shell /bin/bash
git clone https://github.com/plumpudding/hopglass-server server
cd server
npm install
exit

#Create start script and copy default config file:
mkdir -p /etc/hopglass-server/default
cp $INSTALL_DIR/server/config.json.example /etc/hopglass-server/default/config.json
echo 'su - hopglass --shell /bin/bash -c "cd server; node hopglass-server.js --config /etc/hopglass-server/$1/config.json"' > /usr/local/sbin/hopglass-server
chmod +x /usr/local/sbin/hopglass-server

exit
```

2. Review and edit the default configuration under `/etc/hopglass-server/default/config.json`.
3. Start the HopGlass Server: `$ sudo hopglass-server default`
4. (Optionally) Automatically start the HopGlass Server at boot: add `hopglass-server default` to `/etc/rc.local` before `exit 0`.

##After installation

You might want to
- Install a webserver (search for Nginx or Apache) and configure a reverse proxy and gzip-compression
- Install [HopGlass](https://github.com/plumpudding/hopglass)
