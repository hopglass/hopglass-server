#!/bin/sh
if [ "$(whoami)" != "root" ];
then
  echo please execute this script as root!
fi

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

#Symlink systemd service and copy config file:
mkdir -p /etc/hopglass-server/default
cp $INSTALL_DIR/server/config.json.example /etc/hopglass-server/default/config.json
ln -s $INSTALL_DIR/server/systemd/hopglass-server@.service /etc/systemd/system/hopglass-server@.service

echo 
echo '######################################################'
echo '### Start the HopGlass Server using                ###'
echo '### $ sudo systemctl start hopglass-server@default ###'
echo '######################################################'
