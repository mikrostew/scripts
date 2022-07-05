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

unlinked=0
skipped=0
total=0

for repo_path in "$installed_bin_dir"/*
do
  (( total++ ))
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
      echo -e " (${COLOR_FG_YELLOW}skip${COLOR_RESET}) links to '$link_target'"
      (( skipped++ ))
    else
      rm "$bin_path"
      echo -e -n " (${COLOR_FG_GREEN}OK${COLOR_RESET})"
      (( total_length += 5 ))
      printf "\r%-${total_length}s\r" ' '
      (( unlinked++ ))
    fi
  # if a file exists there, don't mess that that
  elif [ -f "$bin_path" ]
  then
    echo -e " (${COLOR_FG_YELLOW}skip${COLOR_RESET}) '$bin_dir' is a file, not a link"
    (( skipped++ ))
  else
    # no link or file, nothing to do here
    printf "\r%-${total_length}s\r" ' '
    (( skipped++ ))
  fi

  # if there is an alias for this script, remove it
  if grep -F "alias $script=$repo_path" "$HOME/.bashrc" >/dev/null
  then
    # have to replace all '/' in the path with '\/' for sed to work
    if [ -L "$HOME/.bashrc" ]
    then
      actual_file="$(readlink "$HOME/.bashrc")"
      sed -i .bak "/alias $script=${repo_path//\//\\\/}/d" "$actual_file"
    else
      sed -i .bak "/alias $script=${repo_path//\//\\\/}/d" "$HOME/.bashrc"
    fi
    (( unaliased++ ))
  fi
done

echo "$total scripts"
echo "  unlinked:  $unlinked"
echo "  unaliased: $unaliased"
echo "  skipped:   $skipped"
