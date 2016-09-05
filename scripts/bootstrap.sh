#!/bin/bash

function ask_user {
  if [ "$(whoami)" != "root" ];
  then
    echo please execute this script as root!
    exit 2
  fi

  if [ ! \( -f /etc/debian_version -o -f /etc/arch-release \) ]
  then
    echo
    echo 'Your system is not supported.'
    exit 2
  elif ! pidof systemd >/dev/null
  then
    echo
    echo 'Your system does not run systemd. It is only partitially supported. '
    echo 'Do you want to continue? [y/N]'
    read CONTINUE
    if [ "$CONTINUE" == "y" ]
    then
      END_NOTICE="$END_NOTICE\nYou will have to write your own init-script or start the hopglass-server directly in \"/etc/rc.local\". \n DON'T RUN THE SERVER AS ROOT UNDER ANY CIRCUMSTANCES! \nThe command for starting the hopglass-server is \"su - hopglass -s /bin/bash -c 'node --harmony /opt/hopglass/server/hopglass-server.js [--config /path/to/config.json]'\"."
    else
      exit 2
    fi
  fi

  DONE=0
  while [ ! $DONE -eq 1 ]
  do
    echo
    echo "This will install a recent version of NodeJS and the HopGlass Server."
    echo "Your old version of NodeJS and all packages depending on it will be removed in the process."
    echo "To abort the process, press CTRL+C."
    echo
    echo "Where do you want to install the HopGlass Server? [/opt/hopglass]"
    read INSTALL_DIR
    INSTALL_DIR="${INSTALL_DIR:-/opt/hopglass}"
    PARENT_DIR="$(echo $INSTALL_DIR | sed 's;/$;;' | rev | cut -d'/' -f2- | rev)"
    if [ ! -d "$PARENT_DIR" ]
    then
      echo The parent directory $PARENT_DIRECTORY doesn\'t exist.
    elif [ -d "$INSTALL_DIR" ] && ! ls "$INSTALL_DIR" >/dev/null 2>&1
    then
      echo 'The specified directory already exists and is not empty. Do you want to continue? [y/N]'
      read CONTINUE
      if [ "$CONTINUE" == "y" ]
      then
        DONE=1
      fi
    else
      DONE=1
    fi
  done
}

function prereq {
  if test -f /etc/debian_version
  then
    ##########
    # Debian #
    ##########

    apt-get update
    apt-get install apt-transport-https curl git lsb-release -y

    #Install NodeJS from external repositories
    DISTRO=$(lsb_release -c -s)
    if [ "$DISTRO" == "stretch" ]
    then
      DISTRO="jessie"
    fi

    if curl -f "https://deb.nodesource.com/node_6.x/dists/$DISTRO/Release" >/dev/null
    then
      apt-get remove nodejs nodejs-legacy npm -y
      curl -s https://deb.nodesource.com/gpgkey/nodesource.gpg.key | apt-key add -
      echo "deb https://deb.nodesource.com/node_6.x $DISTRO main" > /etc/apt/sources.list.d/nodesource.list
      echo "deb-src https://deb.nodesource.com/node_6.x $DISTRO main" >> /etc/apt/sources.list.d/nodesource.list
      apt-get update
      apt-get install nodejs git -y
    else
      END_NOTICE="$END_NOTICE\nYour distribution is not supported by NodeJS. \nYou have to install a recent NodeJS version (>=4) manually. "
    fi

    adduser --system --home=$INSTALL_DIR --group hopglass
  elif test -f /etc/arch-release
  then
    #############
    # ArchLinux #
    #############

    #latest NodeJS is a available in the Arch repos
    pacman -Syy
    pacman -S nodejs npm git --noconfirm --needed

    useradd -Urm -s /usr/bin/nologin -d $INSTALL_DIR hopglass
  fi

  chmod 755 $INSTALL_DIR
  chown hopglass:hopglass $INSTALL_DIR
  rm -rf $INSTALL_DIR/server 2>/dev/null
}

function install {
  #Clone and install NodeJS libs
  su - hopglass --shell /bin/bash <<'EOF'
  git clone https://github.com/hopglass/hopglass-server -b v0.1.1 server
  cd server
  npm install
  exit
EOF
#EOF can't be indented

  #Symlink systemd service and copy config file:
  #only for systemd-systems
  if pidof systemd >/dev/null
  then
    mkdir -p /etc/hopglass-server/default
    cp $INSTALL_DIR/server/config.json.example /etc/hopglass-server/default/config.json
    cp $INSTALL_DIR/server/hopglass-server@.service /lib/systemd/system/
    sed "s;/opt/hopglass;$INSTALL_DIR;g" -i /lib/systemd/system/hopglass-server@.service
    chown -R hopglass:hopglass /etc/hopglass-server

    END_NOTICE="$END_NOTICE\nStart the HopGlass Server using\n'# systemctl start hopglass-server@default'"
  fi
}

ask_user
prereq
install

echo -e $END_NOTICE
