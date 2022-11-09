#!/usr/bin/env badash
# shellcheck shell=bash

# script to refresh an OAuth access token for a Google API

# use like so:
#  $ google-oauth-refresh.sh <client_id> <client_secret> <refresh_token>

# document about how to get the refresh token:
# https://developers.google.com/identity/protocols/OAuth2WebServer#offline


usage=$(cat <<END_USAGE


Usage:
  $0 <keychain-credential-id> <keychain-refresh-id>

  Note:

    <keychain-credential-id> is something like 'spreadsheet-client-creds'

    <keychain-refresh-id> is something like 'spreadsheet-client-refresh'
END_USAGE
)

# Arguments:
# TODO: prompt for these instead of failing?
credential_id="${1:?"No keychain-credential-id given $usage"}"
refresh_id="${2:?"No keychain-refresh-id given $usage"}"

# get things this needs from the keychain
client_creds="$(security find-generic-password -ga "$credential_id" -w 2>&1)"
# shellcheck disable=SC2016
@exit-on-error 'Error: Could not get client credentials:' 'echo "  $client_creds"'

refresh_token="$(security find-generic-password -ga "$refresh_id" -w 2>&1)"
# shellcheck disable=SC2016
@exit-on-error 'Error: Could not get refresh token:' 'echo "  $refresh_token"'

# split the stored client creds on the ':'
IFS=: read -r client_id client_secret <<< "$client_creds"
if [ -z "$client_id" ] || [ -z "$client_secret" ]
then
  @echo-err "Could not get client ID and secret from the keychain"
  @echo-err "Check that the '$credential_id' entry is formatted as <client-id>:<client-secret>"
  exit 1
fi

# various constants
GOOGLE_DISCOVERY_DOC="https://accounts.google.com/.well-known/openid-configuration"

# check requirements
# TODO: use the badash equivalent
requirements=( curl jq mktemp )
all_reqs_ok="true"
for executable in "${requirements[@]}"; do
  if [ ! "$(command -v "$executable")" ]; then
    @echo-err "'$executable' is required but not installed"
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


discovery_doc_json="$(curl "$GOOGLE_DISCOVERY_DOC" 2>"$error_file")"
@exit-on-error "Failed to download discovery doc $GOOGLE_DISCOVERY_DOC"

token_endpoint="$(echo "$discovery_doc_json" | jq --raw-output '.token_endpoint')"

echo "Refreshing access token..."

# refresh the access token
curl \
  -X POST \
  -v \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "client_id=$client_id" \
  --data-urlencode "client_secret=$client_secret" \
  --data-urlencode "refresh_token=$refresh_token" \
  --data-urlencode "grant_type=refresh_token" \
  "$token_endpoint" 2>"$error_file" | jq '.'

# should return something like this:
#  {
#    "access_token": "ya29.Glv...OtQxt",
#    "token_type": "Bearer",
#    "expires_in": 3600,
#    "scope": "https://www.googleapis.com/auth/gmail.readonly"
#  }

@exit-on-error "Error refreshing access token"

