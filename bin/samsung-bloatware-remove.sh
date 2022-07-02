#!/usr/bin/env bash
# Remove bloatware from my Samsung Phone

# References:
# https://forum.xda-developers.com/galaxy-s9-plus/help/list-bloatware-youd-recommend-to-rid-off-t3759500
# https://medium.com/@kaikoenig/samsungs-bloatware-disgrace-c7d14a298ad7

# typical output:
#
# $ adb shell "pm uninstall -k --user 0 com.samsung.android.app.spage"
# Success
#
# $ adb shell "pm uninstall -k --user 0 com.samsung.android.bixby.agent"
# Failure [not installed for 0]

# can find most of these using `adb shell` then `pm list packages -f <name>`


# colors

COLOR_RESET='\033[0m'
COLOR_FG_BOLD_GREEN='\033[1;32m'
COLOR_FG_GREEN='\033[0;32m'
COLOR_FG_RED='\033[0;31m'

# helper functions

pkg-remove-info() {
  action="$1"
  details="$2"

  echo -e -n " ${COLOR_FG_BOLD_GREEN}$action${COLOR_RESET} $details..."
}
pkg-found() {
  echo -e -n "(${COLOR_FG_GREEN}found${COLOR_RESET})..."
}
pkg-not-found() {
  echo -e "(not found)"
}
pkg-removed() {
  echo -e "[${COLOR_FG_GREEN}OK${COLOR_RESET}]"
}
pkg-not-removed() {
  echo -e "[${COLOR_FG_RED}ERROR${COLOR_RESET}]"
}
remove-pkg() {
  pkg_name="$1"

  pkg-remove-info "remove" "'$pkg_name'"
  if [ -n "$(adb shell "pm list packages -f $pkg_name")" ]
  then
    pkg-found
    # try to remove it
    # shellcheck disable=SC2015
    adb shell "pm uninstall -k --user 0 $pkg_name" >/dev/null && pkg-removed || pkg-not-removed
  else
    pkg-not-found
  fi
}

# USB debugging check

echo -n "USB debugging enabled? "
if adb devices 2>/dev/null | grep 'device$' >/dev/null
then
  echo -e "[${COLOR_FG_GREEN}OK${COLOR_RESET}]"
else
  echo -e "[${COLOR_FG_RED}not enabled${COLOR_RESET}]"
  echo "output of 'adb devices':"
  adb devices
  exit
fi

# list of everything to remove

bloatware=(
  # Bixby - this is terrible, no one should ever use it for anything
  com.samsung.android.bixby.agent
  com.samsung.android.bixby.es.globalaction
  com.samsung.android.bixby.wakeup
  com.samsung.android.bixby.plmsync
  com.samsung.android.bixby.voiceinput
  com.samsung.systemui.bixby
  com.samsung.android.bixby.agent.dummy
  com.samsung.android.bixbyvision.framework
  com.samsung.android.app.spage
  com.samsung.android.app.settings.bixby

  # Yahoo - why?
  com.samsung.android.widgetapp.yahooedge.finance
  com.samsung.android.widgetapp.yahooedge.sport

  # Flipboard
  flipboard.boxer.app

  # Skype
  com.skype.raider

  # Kids Installer - what is this?
  com.samsung.android.kidsinstaller

  # Samsung Cloud
  com.samsung.android.scloud
  com.samsung.android.samsungpass
  com.samsung.android.samsungpassautofill

  # Samsung Dex for PC
  com.sec.android.app.dexonpc

  # Samsung Social
  com.samsung.android.app.social

  # TODO: not sure on these
  #com.samsung.android.app.ledcoverdream
  #com.samsung.android.smartswitchassistant
  #com.samsung.android.app.galaxyfinder
  #com.samsung.android.app.aodservice
  #com.samsung.android.app.sbrowseredge
  #com.samsung.android.game.gamehome
  #com.samsung.android.app.tips
  #com.samsung.android.app.talkback
  #com.samsung.android.app.taskedge
  #com.samsung.android.themecenter
  #com.samsung.android.app.appsedge
  #com.samsung.android.app.clipboardedge

  # duplicate apps

  # messaging
  com.samsung.android.messaging
  # email
  com.samsung.android.email.provider
  # contacts
  com.samsung.android.contacts
  com.samsung.android.app.contacts
  # clock
  com.sec.android.app.clockpackage
  # calendar
  com.samsung.android.calendar
  com.samsung.android.opencalendar
  # browser
  com.sec.android.app.sbrowser
  # file viewer
  com.sec.android.app.myfiles
  # gallery
  com.sec.android.gallery3d.panorama360view
  com.sec.android.gallery3d
)

# do it

for package in "${bloatware[@]}"
do
  remove-pkg "$package"
done
