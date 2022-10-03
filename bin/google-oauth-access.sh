#!/usr/bin/env bash

# script to get an OAuth access token for a Google API (because doing it by hand is a PITA)

# use like so:
#  $ google-oauth-access.sh <client_id> <client_secret> https://www.googleapis.com/auth/gmail.readonly

# This was the most helpful document I found to get this stuff setup:
# https://developers.google.com/identity/protocols/OAuth2WebServer


usage=$(cat <<END_USAGE


Usage:
  $0 <client_id> <client_secret> <scope>
END_USAGE
)

# Arguments:
client_id="${1:?"No client_id given $usage"}"
client_secret="${2:?"No client_secret given $usage"}"
scope="${3:?"No scope given $usage"}"

# various constants
GOOGLE_DISCOVERY_DOC="https://accounts.google.com/.well-known/openid-configuration"
proxy_port=8000
redirect_port=1234
redirect_uri="http://127.0.0.1:$redirect_port"
redirect_page="HTTP/1.1 200 OK\r\nContent-Length: 28\r\n\r\n<html><body>ok</body></html>" # (this will be shown in the browser)

OS="$(uname)"

# colors
COLOR_RESET='\033[0m'
COLOR_FG_RED='\033[0;31m'
COLOR_FG_BOLD_BLUE='\033[1;34m'

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
requirements=( curl jq sed grep mktemp nc )
# OS-specific
if [ "$OS" == "Darwin" ]; then
  requirements+=( open )
elif [ "$OS" == "Linux" ]; then
  requirements+=( xdg-open )
fi
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

authorization_endpoint="$(echo "$discovery_doc_json" | jq --raw-output '.authorization_endpoint')"
token_endpoint="$(echo "$discovery_doc_json" | jq --raw-output '.token_endpoint')"


echo "Opening authorization URL in default browser..."

# Linux
if [ "$OS" == "Linux" ]; then
  # start netcat to use as a local proxy, so this doesn't actually go to google
  # (see https://stackoverflow.com/questions/6180162/)
  nc -l localhost $proxy_port >/dev/null 2>&1 &
  # construct a URL to get the auth and refresh tokens
  base_url="$(echo "$authorization_endpoint" | sed 's/https/http/')" # use http here so it shows the GET line
  # use curl to urlencode params (because `xdg-open` doesn't)
  authorization_url="$(curl \
    -G \
    -v \
    --max-time 1 \
    --proxy localhost:$proxy_port \
    --data-urlencode "scope=$scope" \
    --data-urlencode "redirect_uri=$redirect_uri" \
    --data-urlencode "response_type=code" \
    --data-urlencode "client_id=$client_id" \
    --data-urlencode "access_type=offline" \
    "$base_url" \
    |& grep GET \
    | sed -e 's/> GET //' -e 's| HTTP/1.1||' -e 's/http/https/' \
    )"
  # redirect stderr to avoid seeing GLib errors in the console
  xdg-open "$authorization_url" 2>/dev/null
fi

# OSX
if [ "$OS" == "Darwin" ]; then
  # (`open` automatically urlencodes the params)
  authorization_url="$authorization_endpoint?scope=$scope&redirect_uri=$redirect_uri&response_type=code&client_id=$client_id&access_type=offline"
  open "$authorization_url"
fi

echo -e "${COLOR_FG_BOLD_BLUE}$authorization_url${COLOR_RESET}"

echo "Waiting for approval..."

# capture the code from the redirect (since it's going to the local machine):
redirect_request="$(echo -en "$redirect_page" | nc -l $redirect_port 2>$error_file)"
# which returns something like:
#  GET /?code=4/AACaTSd7...4D3mpI1Eo HTTP/1.1
#  Host: 127.0.0.1:1234
#  Connection: keep-alive
#  Cache-Control: max-age=0
#  Upgrade-Insecure-Requests: 1
#  User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/67.0.3396.79 Safari/537.36
#  Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8
#  Accept-Encoding: gzip, deflate, br
#  Accept-Language: en-US,en;q=0.9
exit_on_error "Error capturing the OAuth redirect"

authorization_code="$(echo "$redirect_request" | grep GET | sed -e 's|GET /?code=||' -e 's| HTTP/1.1||')"
echo "authorization_code: $authorization_code"

# get access token
echo "Exchanging authorization code for access token..."
curl \
  -X POST \
  -v \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "code=$authorization_code" \
  --data-urlencode "client_id=$client_id" \
  --data-urlencode "client_secret=$client_secret" \
  --data-urlencode "redirect_uri=$redirect_uri" \
  --data-urlencode "grant_type=authorization_code" \
  "$token_endpoint" 2>$error_file | jq '.'

# should return something like this:
#  {
#    "access_token": "ya29.Glv...OtQxt",
#    "token_type": "Bearer",
#    "expires_in": 3600,
#    "refresh_token": "1/LhL...0ps"
#  }
# or an error:
#  {
#    "error": "invalid_grant",
#    "error_description": "Code was already redeemed."
#  }

exit_on_error "Error getting access token"

