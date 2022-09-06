#!/usr/bin/env bash

# install this repo and symlink scripts into the PATH

COLOR_FG_BOLD_BLUE='\033[1;34m'
COLOR_FG_BOLD_GREEN='\033[1;32m'
COLOR_FG_GREEN='\033[0;32m'
COLOR_FG_RED='\033[0;31m'
COLOR_FG_YELLOW='\033[0;33m'
COLOR_RESET='\033[0m'

if [ -z "$TERM" ] || [ "$TERM" = "dumb" ] || [ "$TERM" = "unknown" ]
then
  COLUMNS=80
else
  COLUMNS="$(tput cols)"
fi

# show a busy spinner while command is running
# and only show output if there is an error
_wait-for-command() {
  # flags
  #  --show-output (bool): always show command output
  #  --clear (bool): clear the spinner
  #  --msg (string): message to show instead of the command
  local more_args=0
  local message=""
  while [ "$more_args" == 0 ]; do
    if [ "$1" == "--show-output" ]; then
      local show_output="true"
      shift
    elif [ "$1" == "--clear" ]; then
      local clear="true"
      shift
    elif [ "$1" == "--msg" ]; then
      shift
      message="$1"
      shift
    else
      more_args=1
    fi
  done
  # (rest of the input is the command and arguments)
  # make sure cmd is not too wide for the terminal
  # - 3 chars for spinner, 3 for ellipsis, 2 for spacing
  local max_length=$(( COLUMNS - 8 ))
  if [ -z "$message" ]; then message="$*"; fi
  local cmd_display="$message"
  if [ "${#message}" -gt "$max_length" ]; then
    cmd_display="${message:0:$max_length}..."
  fi
  local total_length=$(( 3 + ${#cmd_display} ))

  local spin_chars='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏' # braille dots
  local num_chars=${#spin_chars}

  # start the spinner running async, and get its PID
  (
    i=0
    while :
    do
      i=$(( (i + 1) % num_chars ))
      printf "\r ${spin_chars:$i:1} ${cmd_display}" >&2
      sleep 0.1
    done
  ) & disown
  local spinner_pid="$!"

  # kill the spinner process for Ctrl-C, and exit this as well
  trap "kill $spinner_pid && exit" INT TERM

  # run the command, capturing its output (both stdout and stderr)
  cmd_output="$("$@" 2>&1)"
  local exit_code="$?"

  # clear the trap, and stop the spinner
  trap - INT TERM
  kill "$spinner_pid"

  # check that the command was successful
  if [ "$exit_code" == 0 ]
  then
    # attempt to clean up, for --clear option (best effort, this mostly works)
    if [ -n "$clear" ]
    then
      printf "\r%-${total_length}s\r" ' ' >&2
    else
      printf "\r ${COLOR_FG_BOLD_GREEN}✔${COLOR_RESET} $cmd_display\n" >&2
    fi
    # show output if configured
    if [ "$show_output" == "true" ]; then echo "$cmd_output"; fi
  else
    printf "\r ${COLOR_FG_RED}✖${COLOR_RESET} $cmd_display\n" >&2
    # if it fails, show the command output (in red)
    echo -e "${COLOR_FG_RED}$cmd_output${COLOR_RESET}" >&2
  fi
  # pass through the exit code of the internal command, instead of dropping it
  return "$exit_code"
}

# TODO: input options
#  - update (the install dir)
#  - prefix dir
prompt_links=""
prefix_dir=/usr/local

while [ "$#" -gt 0 ]
do
  case "$1" in
    # prompt for each conflicting link, giving the option to overwrite
    --prompt)
      shift
      prompt_links="true"
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

# TODO: check & install pre-reqs - git, volta, node, yarn, python, ruby, etc.

if [ -d "$install_dir" ]
then
  echo -e -n "${COLOR_FG_BOLD_BLUE}Dir '$install_dir' exists, overwrite? [y/N]${COLOR_RESET} "
  read -r overwrite_confirm
  if [ "$overwrite_confirm" == "Y" ] || [ "$overwrite_confirm" == "y" ]
  then
    _wait-for-command rm -rf "$install_dir"
    _wait-for-command git clone https://github.com/mikrostew/scripts.git "$install_dir"
  fi
else
  _wait-for-command git clone https://github.com/mikrostew/scripts.git "$install_dir"
fi

linked=0
aliased=0
skipped=0
overwrote=0
total=0

# TODO: use _wait-for-command with this mess
for repo_path in "$installed_bin_dir"/*
do
  (( total++ ))
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
      if [ "$prompt_links" = "true" ]
      then
        echo -e -n "\r${COLOR_FG_BOLD_BLUE}'$bin_path' links to '$link_target' - (A)lias/(O)verwrite/(S)kip? [A]${COLOR_RESET} "
        read -r link_action
        if [ "$link_action" == "A" ] || [ "$link_action" == "a" ] || [ -z "$link_action" ]
        then
          # alias (default)
          if ! grep -F "alias $script=$repo_path" "$HOME/.bashrc" >/dev/null
          then
            echo "alias $script=$repo_path" >> "$HOME/.bashrc"
            echo -e "(${COLOR_FG_YELLOW}aliased${COLOR_RESET})"
            (( aliased++ ))
          else
            (( skipped++ ))
          fi
        elif [ "$link_action" == "O" ] || [ "$link_action" == "o" ]
        then
          # overwrite
          rm "$bin_path"
          ln -s "$repo_path" "$bin_path"
          echo -e "(${COLOR_FG_RED}overwrite${COLOR_RESET})"
          (( overwrote++ ))
        elif [ "$link_action" == "S" ] || [ "$link_action" == "s" ]
        then
          # skip
          echo -e "(${COLOR_FG_YELLOW}skipped${COLOR_RESET})"
          (( skipped++ ))
        else
          exit
        fi
      else
        # add an alias instead of failing or overwriting
        if ! grep -F "alias $script=$repo_path" "$HOME/.bashrc" >/dev/null
        then
          echo "alias $script=$repo_path" >> "$HOME/.bashrc"
          echo -e " (${COLOR_FG_YELLOW}aliased${COLOR_RESET}) in .bashrc"
          (( aliased++ ))
        else
          printf "\r%-${total_length}s\r" ' '
          (( skipped++ ))
        fi
      fi
    else
      echo -e -n " (${COLOR_FG_YELLOW}skip${COLOR_RESET})"
      (( total_length += 7 ))
      printf "\r%-${total_length}s\r" ' '
      (( skipped++ ))
    fi
  # if a file exists there, don't mess with that
  elif [ -f "$bin_path" ]
  then
    # add an alias instead of failing or overwriting
    if ! grep -F "alias $script=$repo_path" "$HOME/.bashrc" >/dev/null
    then
      echo "alias $script=$repo_path" >> "$HOME/.bashrc"
      echo -e " (${COLOR_FG_YELLOW}aliased${COLOR_RESET}) in .bashrc"
      (( aliased++ ))
    else
      printf "\r%-${total_length}s\r" ' '
      (( skipped++ ))
    fi
  else
    ln -s "$repo_path" "$bin_path"
    echo -e -n " (${COLOR_FG_GREEN}OK${COLOR_RESET})"
    (( total_length += 5 ))
    printf "\r%-${total_length}s\r" ' '
    (( linked++ ))
  fi
done

echo "$total scripts"
echo "  linked:    $linked"
echo "  aliased:   $aliased"
echo "  skipped:   $skipped"

if [ "$prompt_links" = "true" ]
then
  echo "  overwrote: $overwrote"
fi

cd "$install_dir" && _wait-for-command yarn install
