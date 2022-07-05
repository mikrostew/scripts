#!/usr/bin/env bash

# install this repo and symlink scripts into the PATH

COLOR_FG_BOLD_BLUE='\033[1;34m'
COLOR_FG_GREEN='\033[0;32m'
COLOR_FG_RED='\033[0;31m'
COLOR_FG_YELLOW='\033[0;33m'
COLOR_RESET='\033[0m'

# TODO: input options
#  - overwrite (for the install dir)
#  - prefix dir
force_links=""
prefix_dir=/usr/local

while [ "$#" -gt 0 ]
do
  case "$1" in
    --force)
      shift
      force_links="true"
      ;;
    *)
      echo "Unknown argument '$1'"
      exit 1
      ;;
  esac
done

install_dir="$prefix_dir/lib/scripts"
installed_bin_dir="$install_dir/bin"
bin_dir="$prefix_dir/bin"

if [ -d "$install_dir" ]
then
  echo -e -n "${COLOR_FG_BOLD_BLUE}Dir '$install_dir' already exists, overwrite? [y/N]${COLOR_RESET} "
  read -r overwrite_confirm
  if [ "$overwrite_confirm" == "Y" ] || [ "$overwrite_confirm" == "y" ]
  then
    rm -rf "$install_dir"
  else
    exit
  fi
fi

# TODO: check/install pre-reqs - git, volta, node, yarn, python, ruby, etc.

git clone https://github.com/mikrostew/scripts.git "$install_dir"

added=0
skipped=0
failed=0
forced=0

for repo_path in "$installed_bin_dir"/*
do
  # delete up to the last slash
  script="${repo_path##*/}"
  bin_path="$bin_dir/$script"
  echo -n "$bin_path => $repo_path"
  total_length=$(( ${#bin_path} + 4 + ${#repo_path} ))

  # if the link exists, make sure it points to the right location
  if [ -L "$bin_path" ]
  then
    link_target="$(readlink "$bin_path")"
    if [ "$link_target" != "$repo_path" ]
    then
      if [ "$force_links" = "true" ]
      then
        rm "$bin_path"
        ln -s "$repo_path" "$bin_path"
        echo -e -n " [${COLOR_FG_GREEN}OK${COLOR_RESET}]"
        (( total_length += 5 ))
        printf "\r%-${total_length}s\r" ' '
        (( forced++ ))
      else
        echo -e " [${COLOR_FG_RED}fail${COLOR_RESET}] links to '$link_target'"
        (( failed++ ))
      fi
    else
      echo -e -n " [${COLOR_FG_YELLOW}skip${COLOR_RESET}]"
      (( total_length += 7 ))
      printf "\r%-${total_length}s\r" ' '
      (( skipped++ ))
    fi
  # if a file exists there, don't mess that that
  elif [ -f "$bin_path" ]
  then
    echo -e " [${COLOR_FG_RED}fail${COLOR_RESET}] file '$bin_path' already exists"
    (( failed++ ))
  else
    ln -s "$repo_path" "$bin_path"
    echo -e -n " [${COLOR_FG_GREEN}OK${COLOR_RESET}]"
    (( total_length += 5 ))
    printf "\r%-${total_length}s\r" ' '
    (( added++ ))
  fi
done

if [ "$force_links" = "true" ]
then
  echo "linked scripts: $added added, $forced forced, $skipped skipped, $failed failed"
else
  echo "linked scripts: $added added, $skipped skipped, $failed failed"
fi

cd "$install_dir" && yarn install
