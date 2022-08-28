# scripts

## Installation

`curl https://raw.githubusercontent.com/mikrostew/scripts/main/install.sh | bash`

Note that many (most) of these scripts use [badash](https://github.com/mikrostew/badash), which you will need to have installed.

There are other prerequisites which will be checked by the install script, at some point.

## Uninstall

`/usr/local/lib/scripts/uninstall.sh`
`rm -rf /usr/local/lib/scripts`

## What are all of these scripts?

Eventually (TM) I will add descriptions for these things

## How these are organized

Executable scripts are in `bin/`.

Source Node scripts are in `src/`, and are compiled by `tsc` into JS files in `node/` during postinstall.

Unused things are in `unused/`, unsurprisingly.
