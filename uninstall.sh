#!/usr/bin/env bash

# remove script symlinks from the PATH
# TODO: input options
#  - prefix dir

COLOR_FG_GREEN='\033[0;32m'
COLOR_FG_YELLOW='\033[0;33m'
COLOR_RESET='\033[0m'

prefix_dir=/usr/local

install_dir="$prefix_dir/lib/scripts"
installed_bin_dir="$install_dir/bin"
bin_dir="$prefix_dir/bin"

deleted=0
skipped=0
noop=0

for repo_path in "$installed_bin_dir"/*
do
  # delete up to the last slash
  script="${repo_path##*/}"
  bin_path="$bin_dir/$script"
  echo -n "$bin_path => $repo_path"
  total_length=$(( ${#bin_path} + 4 + ${#repo_path} ))

  # if the link exists, make sure it points to the right location before deleting
  if [ -L "$bin_path" ]
  then
    link_target="$(readlink "$bin_path")"
    if [ "$link_target" != "$repo_path" ]
    then
      echo -e " [${COLOR_FG_YELLOW}skip${COLOR_RESET}] links to '$link_target'"
      (( skipped++ ))
    else
      rm "$bin_path"
      echo -e -n " [${COLOR_FG_GREEN}OK${COLOR_RESET}]"
      (( total_length += 5 ))
      printf "\r%-${total_length}s\r" ' '
      (( deleted++ ))
    fi
  # if a file exists there, don't mess that that
  elif [ -f "$bin_path" ]
  then
    echo -e " [${COLOR_FG_YELLOW}skip${COLOR_RESET}] '$bin_dir' is a file, not a link"
    (( skipped++ ))
  else
    # no link or file, nothing to do here
    printf "\r%-${total_length}s\r" ' '
    (( noop++ ))
  fi
done

echo "removed scripts: $deleted deleted, $skipped skipped, $noop didn't exist"
