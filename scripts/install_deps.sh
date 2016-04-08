#!/bin/sh
if [ "$(whoami)" = "root" ];
then
  echo don\'t execute this script as root!
fi
cd $(dirname $0)/..
npm install
