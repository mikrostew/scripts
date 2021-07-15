#!/usr/bin/env ts-node

// TODO: transition the rest of the tasks here

import path from 'path';
import os from 'os';

import execa from 'execa';
import Listr, { ListrContext, ListrTask } from 'listr';
import which from 'which';

enum TaskType {
  KILL_PROC = 'kill-proc',
  HOMEBREW = 'homebrew',
  VOLTA_PACKAGE = 'volta-package',
  EXEC = 'exec',
  EXEC_AND_SAVE = 'exec-and-save',
  GROUP = 'group',
}

interface Config {
  machines: MachineConfig;
  tasks: ConfigTask[];
}

type ConfigTask =
  | KillProcessTask
  | HomebrewTask
  | VoltaPackageTask
  | ExecTask
  | ExecAndSaveTask
  | TaskGroup;

interface KillProcessTask {
  name: string;
  type: TaskType.KILL_PROC;
  machines: string[];
  processes: string[];
}

interface HomebrewTask {
  type: TaskType.HOMEBREW;
  machines: string[];
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
  machines: string[];
  packages: VoltaPackage[];
}

interface VoltaPackage {
  name: string;
}

interface ExecTask {
  name: string;
  type: TaskType.EXEC;
  machines: string[];
  command: string;
  args: string[];
}

// exec a command and save the output in the configured variable in the context
interface ExecAndSaveTask {
  type: TaskType.EXEC_AND_SAVE;
  machines: string[];
  varName: string;
  command: string;
  args: string[];
}

// group tasks together
interface TaskGroup {
  name: string;
  type: TaskType.GROUP;
  machines: string[];
  tasks: ConfigTask[];
}

// machine names map to the keys of this object
// (so that adding a task is easy, because it's done often,
//  but adding a machine is harder, and is done less often)
interface MachineConfig {
  [key: string]: RegExp;
}

// TODO: read config file for this
const config: Config = {
  machines: {
    homeLaptop: /(MacBook-Air|Michaels-Air)/,
    workLaptop: /mistewar-mn/,
    workVM: /mistewar-ld/,
  },
  tasks: [
    // for the work laptop, need to get the password first
    // TODO: enable this once I have other tasks that need it
    // {
    //   type: TaskType.EXEC_AND_SAVE,
    //   machines: ['workLaptop'],
    //   varName: 'ldap_pass',
    //   command: 'security',
    //   args: ['find-generic-password', '-ga', 'ldap_pass', '-w'],
    // },
    {
      name: 'Kill processes (all laptops)',
      type: TaskType.KILL_PROC,
      // things to kill on both laptops
      machines: ['homeLaptop', 'workLaptop'],
      processes: ['Activity Monitor', 'zoom.us', 'App Store', 'Discord', 'Microsoft Word'],
    },
    {
      name: 'Kill processes (work laptop)',
      type: TaskType.KILL_PROC,
      machines: ['workLaptop'],
      processes: ['Outlook', 'Microsoft Error Reporting', 'Slack', 'Microsoft Teams'],
    },
    {
      type: TaskType.HOMEBREW,
      machines: ['homeLaptop', 'workLaptop'],
      packages: [
        { name: 'bats-core', executable: 'bats' },
        { name: 'expect', executable: 'expect' },
        { name: 'gh', executable: 'gh' },
        { name: 'gimp', executable: 'gimp' },
        { name: 'git', executable: 'git' },
        { name: 'git-gui', executable: 'git-gui' },
        { name: 'tidy-html5', executable: 'tidy' },
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
      type: TaskType.VOLTA_PACKAGE,
      machines: ['homeLaptop', 'workLaptop', 'workVM'],
      packages: [
        { name: '@11ty/eleventy' },
        { name: 'backstopjs' },
        { name: 'cowsay' },
        { name: 'ember-cli' },
        { name: 'eslint' },
        { name: 'gulp' },
        { name: 'ts-node' },
        { name: 'typescript' },
      ],
    },
    {
      name: 'Update Rust',
      type: TaskType.EXEC,
      machines: ['homeLaptop', 'workLaptop', 'workVM'],
      command: 'rustup',
      args: ['update'],
    },
    {
      name: 'Download moment garden pics & videos',
      type: TaskType.EXEC,
      machines: ['homeLaptop', 'workLaptop'],
      command: 'moment-garden-download',
      args: [],
    },
    {
      name: 'Download audio playlists from YT',
      type: TaskType.EXEC,
      machines: ['homeLaptop', 'workLaptop'],
      command: 'download-yt-audio-playlists',
      args: [],
    },
    {
      name: 'Verify dotfile links are good',
      type: TaskType.EXEC,
      machines: ['homeLaptop', 'workLaptop', 'workVM'],
      command: 'verify-dotfile-links',
      args: [path.join(os.homedir(), 'src/gh/dotfiles')],
    },
    {
      name: 'Make sure syncthing is running',
      type: TaskType.EXEC,
      machines: ['homeLaptop', 'workLaptop'],
      command: 'pgrep',
      args: ['syncthing'],
    },
    {
      name: 'Check music files',
      type: TaskType.GROUP,
      machines: ['homeLaptop', 'workLaptop'],
      tasks: [],
    },
    // TODO: some task that checks for VPN, and blocks following tasks
  ],
};

// return if the input executable is installed or not
async function isExecutableInstalled(executable: string): Promise<boolean> {
  return which(executable)
    .then(() => true)
    .catch(() => false);
}

// convert process name into a task to kill that process
function killProcessToTask(processName: string): ListrTask {
  return {
    title: `kill process '${processName}'`,
    task: async () => {
      try {
        await execa('pkill', [processName]);
      } catch (err) {
        // probably the process doesn't exist, that's fine
        return true;
      }
    },
  };
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
    title: `ensure '${pkg.name}' is installed`,
    task: async () => {
      const isInstalled = await isVoltaPackageInstalled(pkg.name);
      if (!isInstalled) {
        return execa('npm', ['i', '-g', pkg.name]);
      }
    },
  };
}

async function isVoltaPackageInstalled(name: string): Promise<boolean> {
  const { stdout } = await execa('volta', ['list', name]);
  if (stdout === undefined || stdout === '' || /No tools or packages installed/.test(stdout)) {
    return false;
  }
  return true;
}

// should this task run on this machine?
function shouldRunForMachine(
  task: ConfigTask,
  machineConfig: MachineConfig,
  currentMachine: string
): boolean {
  return task.machines.some((machineName) => machineConfig[machineName]?.test(currentMachine));
}

// convert a task from config to tasks that listr can use
function configTaskToListrTask(
  task: ConfigTask,
  machineConfig: MachineConfig,
  currentMachine: string
): ListrTask {
  switch (task.type) {
    case TaskType.KILL_PROC:
      return {
        title: task.name,
        enabled: () => shouldRunForMachine(task, machineConfig, currentMachine),
        task: () => {
          // convert all the process names to tasks
          return new Listr(
            task.processes.map((processName) => killProcessToTask(processName)),
            { exitOnError: false }
          );
        },
      };
    case TaskType.HOMEBREW:
      return {
        title: 'Homebrew',
        enabled: () => shouldRunForMachine(task, machineConfig, currentMachine),
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
        enabled: () => shouldRunForMachine(task, machineConfig, currentMachine),
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
        title: task.name,
        enabled: () => shouldRunForMachine(task, machineConfig, currentMachine),
        // just execa the info from the config
        task: () => execa(task.command, task.args),
      };
    case TaskType.EXEC_AND_SAVE:
      return {
        title: `Save '${task.command} ${task.args}' to ${task.varName}`,
        enabled: () => shouldRunForMachine(task, machineConfig, currentMachine),
        // execa the command and save the output
        task: async (ctx) => {
          const { stdout } = await execa(task.command, task.args);
          ctx[task.varName] = stdout;
        },
      };
    case TaskType.GROUP:
      return {
        title: task.name,
        enabled: () => shouldRunForMachine(task, machineConfig, currentMachine),
        task: () => {
          return new Listr(
            // convert all the tasks contained in this group
            task.tasks.map((t) => configTaskToListrTask(t, machineConfig, currentMachine)),
            { exitOnError: false }
          );
        },
      };
  }
}

// this machines name
const machineName = os.hostname();
console.log(`Running for machine '${machineName}'`);

// TODO: read and validate config (all machine names match, etc.)

const tasks: Listr = new Listr(
  config.tasks.map((task) => configTaskToListrTask(task, config.machines, machineName)),
  { exitOnError: false }
);

tasks.run().catch((err) => {
  // TODO: when does this error?
  console.error(err);
});
