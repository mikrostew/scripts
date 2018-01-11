#!/usr/bin/env bash

# main loop - walk backwards thru the repo, 1 commit at a time, figure out when these errors were introduced
# this file starts a specific hash to drill down to the specific commit causing the error
# I should be able to run this along with the other one, since each is only a single process

starting_commit="8b2707172ca49595b2b8efaba2721c10a08acb66"

# start at a specific hash for this one
git checkout $starting_commit

echo "RUNNING..."

for i in {0..10}; do
  echo "commits behind $starting_commit: $i, date: $(git show -s --format=%ci), hash: $(git rev-parse HEAD)"
  # the eslint calculation:
  prettier_errors="$(just node node_modules/eslint/bin/eslint.js extended core global lib engine-lib | grep prettier | wc -l )"
  echo "prettier errors: $prettier_errors"
  # go back 1 commit
  git checkout HEAD~1 2>/dev/null
done

echo "DONE"

# reset
git checkout master 2>/dev/null
