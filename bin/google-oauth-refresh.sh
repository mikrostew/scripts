#!/usr/bin/env bash

# script to refresh an OAuth access token for a Google API

# use like so:
#  $ google-oauth-refresh.sh <client_id> <client_secret> <refresh_token>

# document about how to get the refresh token:
# https://developers.google.com/identity/protocols/OAuth2WebServer#offline


usage=$(cat <<END_USAGE


Usage:
  $0 <client_id> <client_secret> <refresh_token>
END_USAGE
)

# Arguments:
client_id="${1:?"No client_id given $usage"}"
client_secret="${2:?"No client_secret given $usage"}"
refresh_token="${3:?"No refresh_token given $usage"}"

# various constants
GOOGLE_DISCOVERY_DOC="https://accounts.google.com/.well-known/openid-configuration"

# colors
COLOR_RESET='\033[0m'
COLOR_FG_RED='\033[0;31m'

# error functions
echo_err() {
  echo -e "${COLOR_FG_RED}$@${COLOR_RESET}" >&2
}
exit_on_error() {
  if [ "$?" -ne 0 ]; then
    exit_code=$?
    echo_err "$1"
    echo_err "$(< $error_file)"
    exit $exit_code
  fi
}

# check requirements
requirements=( curl jq mktemp )
all_reqs_ok="true"
for executable in "${requirements[@]}"; do
  if [ ! $(command -v $executable) ]; then
    echo_err "'$executable' is required but not installed"
    all_reqs_ok="false"
  fi
done
if [ "$all_reqs_ok" == "false" ]; then
  exit 1
fi

# tmp file to capture errors
error_file="$(mktemp /tmp/errors.XXXXXX)"
finish() {
  rm "$error_file"
}
trap finish EXIT


discovery_doc_json="$(curl "$GOOGLE_DISCOVERY_DOC" 2>$error_file)"
exit_on_error "Failed to download discovery doc $GOOGLE_DISCOVERY_DOC"

token_endpoint="$(echo "$discovery_doc_json" | jq --raw-output '.token_endpoint')"

# refresh the access token
curl \
  -X POST \
  -v \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "client_id=$client_id" \
  --data-urlencode "client_secret=$client_secret" \
  --data-urlencode "refresh_token=$refresh_token" \
  --data-urlencode "grant_type=refresh_token" \
  "$token_endpoint" 2>$error_file | jq --compact-output '.'

# should return something like this:
#  {
#    "access_token": "ya29.Glv...OtQxt",
#    "token_type": "Bearer",
#    "expires_in": 3600,
#    "scope": "https://www.googleapis.com/auth/gmail.readonly"
#  }

exit_on_error "Error refreshing access token"

