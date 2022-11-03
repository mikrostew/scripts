#!/usr/bin/env bash

# install this repo and symlink scripts into the PATH

COLOR_FG_BOLD_GREEN='\033[1;32m'
COLOR_FG_RED='\033[0;31m'
COLOR_RESET='\033[0m'

COLUMNS="$(if [ -z "$TERM" ] || [ "$TERM" = "dumb" ] || [ "$TERM" = "unknown" ]; then echo 80; else tput cols; fi)"

# show a busy spinner while command is running
# and only show output if there is an error
_wait-for-command() {
  # make sure cmd is not too wide for the terminal
  # - 3 chars for spinner, 3 for ellipsis, 2 for spacing
  local max_length=$(( COLUMNS - 8 ))
  local message="$*"
  if [ "${#message}" -gt "$max_length" ]; then
    cmd_display="${message:0:$max_length}..."
  else
    cmd_display="$message"
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
    # write a final display with check mark for success
    printf "\r ${COLOR_FG_BOLD_GREEN}✔${COLOR_RESET} $cmd_display\n" >&2
  else
    printf "\r ${COLOR_FG_RED}✖${COLOR_RESET} $cmd_display\n" >&2
    # if it fails, show the command output (in red)
    echo -e "${COLOR_FG_RED}$cmd_output${COLOR_RESET}" >&2
  fi
  # pass through the exit code of the internal command, instead of dropping it
  return "$exit_code"
}

# show an animated prompt while waiting for input
_prompt-for-input() {
  # arguments:
  # - prompt string
  # - variable to store user input
  prompt_str="$1"
  read_var_name="$2"

  local prompt_animation=( ">  " " > " "  >" " > " )
  local num_frames=${#prompt_animation[@]}

  # echo the prompt
  printf "\r%s %s " "${prompt_animation[0]}" "$prompt_str"

  # start the animation running async, and get its PID
  (
    i=0
    while :
    do
      printf "\r%s %s " "${prompt_animation[$i]}" "$prompt_str" >&2
      sleep 0.2
      i=$(( (i + 1) % num_frames ))
    done
  ) & disown
  local animation_pid="$!"

  # kill the animation process for Ctrl-C, cleanup, and return failure
  trap "kill $animation_pid && echo "" && return 1" INT TERM

  # read input from the user
  read -r "${read_var_name?}"

  # clear the trap, and stop the spinner
  trap - INT TERM
  kill "$animation_pid"

  # sometimes a duplicate line will be printed
  # (race condition with killing the spawned process)
  # so clean that up if it happens
  printf "\r    %-${#total_length}s\r" ' ' >&2

  return 0
}


# TODO: input options
#  - update (the install dir)
#  - prefix dir
prefix_dir=/usr/local

while [ "$#" -gt 0 ]
do
  case "$1" in
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
  _prompt-for-input "Dir '$install_dir' exists, overwrite? [y/N]" overwrite_confirm
  if [ "$?" -ne 0 ]; then exit; fi # got Ctrl-C
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
current=0

links_to_process=( "$installed_bin_dir"/* )
total_links="${#links_to_process[@]}"
for repo_path in "${links_to_process[@]}"
do
  (( current++ ))
  # delete up to the last slash
  script="${repo_path##*/}"
  bin_path="$bin_dir/$script"

  echo -e -n "\r ($current/$total_links) $script "
  total_length=$(( 2 + 3 + 1 + 3 + 2 + ${#script} + 1 ))

  # if the link exists, make sure it points to the right location
  if [ -L "$bin_path" ]
  then
    link_target="$(readlink "$bin_path")"
    if [ "$link_target" != "$repo_path" ]
    then
      # the link doesn't point to this repo,
      # add an alias instead of failing or overwriting
      if ! grep -F "alias $script=$repo_path" "$HOME/.bashrc" >/dev/null
      then
        echo "alias $script=$repo_path" >> "$HOME/.bashrc"
      fi
      (( aliased++ ))
    else
      # already points to this repo, nothing to do
      (( linked++ ))
    fi
  # if a file exists there, don't mess with that
  elif [ -f "$bin_path" ]
  then
    # add an alias instead of failing or overwriting
    if ! grep -F "alias $script=$repo_path" "$HOME/.bashrc" >/dev/null
    then
      echo "alias $script=$repo_path" >> "$HOME/.bashrc"
    fi
    (( aliased++ ))
  else
    ln -s "$repo_path" "$bin_path"
    (( linked++ ))
  fi
  printf "\r%-${total_length}s\r" ' '
done
printf "\r ${COLOR_FG_BOLD_GREEN}✔${COLOR_RESET} setup scripts ($total_links): symlinked $linked, aliased $aliased\n"


# remove symlinks to any scripts that no longer exist
bin_entries_to_process=( "$bin_dir"/* )
total_links="${#bin_entries_to_process[@]}"
current=0
kept=0
removed=0

for bin_entry in "${bin_entries_to_process[@]}"
do
  (( current++ ))
  # delete up to the last slash
  script="${bin_entry##*/}"
  # this is where the script exists in this repo
  repo_path="$installed_bin_dir/$script"

  echo -e -n "\r ($current/$total_links) $script "
  total_length=$(( 2 + 3 + 1 + 3 + 2 + ${#script} + 1 ))

  # if this is a link, and it points to this repo, check if that bin still exists
  if [ -L "$bin_entry" ]
  then
    link_target="$(readlink "$bin_entry")"
    if [ "$link_target" == "$repo_path" ]
    then
      if ! [ -f "$repo_path" ]
      then
        # target doesn't exist, remove the link
        (( removed++ ))
        rm "$bin_entry"
      else
        (( kept++ ))
      fi
    fi
  fi
  printf "\r%-${total_length}s\r" ' '
done
printf "\r ${COLOR_FG_BOLD_GREEN}✔${COLOR_RESET} check dead links ($total_links): kept $kept, removed $removed\n"

cd "$install_dir" && _wait-for-command yarn install
