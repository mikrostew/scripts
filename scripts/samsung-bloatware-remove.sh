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


##########################
# useless or worse
##########################

# Bixby - this is terrible, no one should ever use it for anything
adb shell "pm uninstall -k --user 0 com.samsung.android.bixby.agent"
adb shell "pm uninstall -k --user 0 com.samsung.android.bixby.es.globalaction"
adb shell "pm uninstall -k --user 0 com.samsung.android.bixby.wakeup"
adb shell "pm uninstall -k --user 0 com.samsung.android.bixby.plmsync"
adb shell "pm uninstall -k --user 0 com.samsung.android.bixby.voiceinput"
adb shell "pm uninstall -k --user 0 com.samsung.systemui.bixby"
adb shell "pm uninstall -k --user 0 com.samsung.android.bixby.agent.dummy"
adb shell "pm uninstall -k --user 0 com.samsung.android.bixbyvision.framework"
adb shell "pm uninstall -k --user 0 com.samsung.android.app.spage"

# Yahoo - why?
adb shell "pm uninstall -k --user 0 com.samsung.android.widgetapp.yahooedge.finance"
adb shell "pm uninstall -k --user 0 com.samsung.android.widgetapp.yahooedge.sport"

# Flipboard
adb shell "pm uninstall -k --user 0 flipboard.boxer.app"

# Skype
adb shell "pm uninstall -k --user 0 com.skype.raider"

# Kids Installer - what is this?
adb shell "pm uninstall -k --user 0 com.samsung.android.kidsinstaller"

# Samsung Cloud
adb shell "pm uninstall -k --user 0 com.samsung.android.scloud"
adb shell "pm uninstall -k --user 0 com.samsung.android.samsungpass"
adb shell "pm uninstall -k --user 0 com.samsung.android.samsungpassautofill"

# Samsung Dex for PC
adb shell "pm uninstall -k --user 0 com.sec.android.app.dexonpc"


##########################
# duplicate apps
##########################

# messaging
adb shell "pm uninstall -k --user 0 com.samsung.android.messaging"
# email
adb shell "pm uninstall -k --user 0 com.samsung.android.email.provider"
# contacts
adb shell "pm uninstall -k --user 0 com.samsung.android.contacts"
# clock
adb shell "pm uninstall -k --user 0 com.sec.android.app.clockpackage"
# calendar
adb shell "pm uninstall -k --user 0 com.samsung.android.calendar"
# browser
adb shell "pm uninstall -k --user 0 com.sec.android.app.sbrowser"
# file viewer
adb shell "pm uninstall -k --user 0 com.sec.android.app.myfiles"
# gallery
adb shell "pm uninstall -k --user 0 com.sec.android.gallery3d"
