#!/usr/bin/env bash

# main loop - walk backwards thru the repo, 10 commits at a time, figure out when these errors were introduced
# (10 at a time, since this takes 7 minutes to run the eslint check)

starting_commit="2fb10756bccaf9d442ea4c80f1167538f3d7f4e7"

git checkout $starting_commit

echo "RUNNING..."

for i in {0..200..10}; do
  echo "commits behind $starting_commit: $i, date: $(git show -s --format=%ci), hash: $(git rev-parse HEAD)"
  # the eslint calculation:
  prettier_errors="$(just node node_modules/eslint/bin/eslint.js extended core global lib engine-lib | grep prettier | wc -l )"
  echo "prettier errors: $prettier_errors"
  # go back 10 commits
  git checkout HEAD~10 2>/dev/null
done

echo "DONE"

# reset
git checkout master 2>/dev/null
