#!/usr/bin/env ts-node

// TODO: start transitioning tasks here

import execa from 'execa';
import Listr, { ListrContext, ListrTask } from 'listr';
import which from 'which';

enum TaskType {
  HOMEBREW = 'homebrew',
  VOLTA_PACKAGE = 'volta-package',
  EXEC = 'exec',
}

type ConfigTask = HomebrewTask | VoltaPackageTask | ExecTask;

interface HomebrewTask {
  type: TaskType.HOMEBREW;
  packages: HomebrewPackage[];
}

interface HomebrewPackage {
  // name of the package
  name: string;
  // name of an executable installed by the package
  executable: string;
}

interface VoltaPackageTask {
  type: TaskType.VOLTA_PACKAGE;
  packages: VoltaPackage[];
}

interface VoltaPackage {
  name: string;
}

interface ExecTask {
  type: TaskType.EXEC;
  command: string;
  args: string[];
}

// TODO: read config file for this
// TODO: link machine names/IDs to the tasks they should run
const config: ConfigTask[] = [
  {
    type: TaskType.HOMEBREW,
    packages: [
      { name: 'bats-core', executable: 'bats' },
      { name: 'expect', executable: 'expect' },
      { name: 'gh', executable: 'gh' },
      { name: 'gimp', executable: 'gimp' },
      { name: 'git', executable: 'git' },
      { name: 'git-gui', executable: 'git-gui' },
      { name: 'imagemagick', executable: 'magick' },
      { name: 'jq', executable: 'jq' },
      { name: 'macvim', executable: 'mvim' },
      { name: 'moreutils', executable: 'sponge' },
      { name: 'ruby-install', executable: 'ruby-install' },
      { name: 'terminal-notifier', executable: 'terminal-notifier' },
      { name: 'tmux', executable: 'tmux' },
      { name: 'watch', executable: 'watch' },
      { name: 'wget', executable: 'wget' },
      { name: 'youtube-dl', executable: 'youtube-dl' },
    ],
  },
  {
    // TODO: this is not working right
    type: TaskType.VOLTA_PACKAGE,
    packages: [
      { name: '@11ty/eleventy' },
      { name: 'backstopjs' },
      { name: 'cowsay' },
      { name: 'ember-cli' },
      { name: 'eslint' },
      { name: 'gulp' },
      { name: 'ts-node' },
      { name: 'typescript' },
      { name: 'torpedo' },
    ],
  },
  {
    type: TaskType.EXEC,
    command: 'rustup',
    args: ['update'],
  },
  {
    type: TaskType.EXEC,
    command: 'moment-garden-download',
    args: [],
  },
];

// return if the input executable is installed or not
async function isExecutableInstalled(executable: string): Promise<boolean> {
  return which(executable)
    .then(() => true)
    .catch(() => false);
}

// convert homebrew packages to list of tasks for install/upgrade
function homebrewPackageToTask(pkg: HomebrewPackage): ListrTask {
  return {
    title: `install or upgrade ${pkg.name} (${pkg.executable})`,
    task: async () => {
      if (await isExecutableInstalled(pkg.executable)) {
        return execa('brew', ['upgrade', pkg.name]);
      } else {
        return execa('brew', ['install', pkg.name]);
      }
    },
  };
}

// first need to update homebrew
function mainHomebrewTask(): ListrTask {
  return {
    title: 'brew update',
    task: () => execa('brew', ['update']),
  };
}

// just install missing packages - don't automatically upgrade
function voltaPackageToTask(pkg: VoltaPackage): ListrTask {
  return {
    title: `ensure ${pkg.name} is installed`,
    task: async () => {
      if (!(await isVoltaPackageInstalled(pkg.name))) {
        return execa('npm', ['i', '-g', pkg.name]);
      }
    },
  };
}

async function isVoltaPackageInstalled(name: string): Promise<boolean> {
  const { stdout } = await execa('volta', ['list', name]);
  if (stdout === undefined) {
    return false;
  }
  return /No tools or packages installed/.test(stdout) ? false : true;
}

// convert a task from config to tasks that listr can use
function configTaskToListrTask(task: ConfigTask): ListrTask {
  switch (task.type) {
    case TaskType.HOMEBREW:
      return {
        title: 'Homebrew',
        task: () => {
          // convert all the configured homebrew packages to tasks
          return new Listr(
            [mainHomebrewTask()].concat(task.packages.map((pkg) => homebrewPackageToTask(pkg))),
            { exitOnError: false }
          );
        },
      };
    case TaskType.VOLTA_PACKAGE:
      return {
        title: 'Volta Packages',
        task: () => {
          // convert all the configured homebrew packages to tasks
          return new Listr(
            task.packages.map((pkg) => voltaPackageToTask(pkg)),
            { exitOnError: false }
          );
        },
      };
    case TaskType.EXEC:
      return {
        title: `${task.command} ${task.args}`,
        // just execa the info from the config
        task: () => execa(task.command, task.args),
        // TODO: how to not exitOnError?
      };
  }
}

const tasks: Listr = new Listr(config.map((task) => configTaskToListrTask(task)));

tasks.run().catch((err) => {
  // TODO: when does this error?
  console.error(err);
});
