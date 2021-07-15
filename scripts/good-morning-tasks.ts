#!/usr/bin/env ts-node

// TODO: transition the rest of the tasks here

import { promises as fsPromises } from 'fs';
import path from 'path';
import os from 'os';

import chalk from 'chalk';
import execa from 'execa';
import Listr, { ListrContext, ListrTask, ListrTaskResult } from 'listr';
import which from 'which';

enum TaskType {
  KILL_PROC = 'kill-proc',
  HOMEBREW = 'homebrew',
  VOLTA_PACKAGE = 'volta-package',
  EXEC = 'exec',
  EXEC_AND_SAVE = 'exec-and-save',
  GROUP = 'group',
  FUNCTION = 'function',
}

interface Config {
  // any environment vars to set for this
  environment?: {
    [key: string]: string;
  };
  // matching machine names
  machines: MachineMatchConfig;
  // the actual tasks to run, based on machine config
  tasks: ConfigTask[];
}

// specify a list of machine names, or inherit from parent task
type MachineSpec = string[] | 'inherit';

type ConfigTask =
  | KillProcessTask
  | HomebrewTask
  | VoltaPackageTask
  | ExecTask
  | ExecAndSaveTask
  | TaskGroup
  | FunctionTask;

interface KillProcessTask {
  name: string;
  type: TaskType.KILL_PROC;
  machines: MachineSpec;
  processes: string[];
}

interface HomebrewTask {
  type: TaskType.HOMEBREW;
  machines: MachineSpec;
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
  machines: MachineSpec;
  packages: VoltaPackage[];
}

interface VoltaPackage {
  name: string;
}

interface ExecTask {
  name: string;
  type: TaskType.EXEC;
  machines: MachineSpec;
  command: string;
  args: string[];
}

// exec a command and save the output in the configured variable in the context
interface ExecAndSaveTask {
  type: TaskType.EXEC_AND_SAVE;
  machines: MachineSpec;
  varName: string;
  command: string;
  args: string[];
}

// group tasks together
interface TaskGroup {
  name: string;
  type: TaskType.GROUP;
  machines: MachineSpec;
  tasks: ConfigTask[];
}

// run a JS function
interface FunctionTask {
  name: string;
  type: TaskType.FUNCTION;
  machines: MachineSpec;
  function: () => void | ListrTaskResult<any>;
}

// machine names map to the keys of this object
// (so that adding a task is easy, because it's done often,
//  but adding a machine is harder, and is done less often)
interface MachineMatchConfig {
  [key: string]: RegExp;
}

// TODO: read config file for this
const config: Config = {
  environment: {
    // TODO: provide hostname somehow in the config file
    BASE_SYNC_DIR: /(MacBook-Air|Michaels-Air)/.test(os.hostname())
      ? process.env['HOME']!
      : '/usr/local/SyncThing',
  },
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
      name: 'Check workout music files',
      type: TaskType.GROUP,
      machines: ['homeLaptop', 'workLaptop'],
      tasks: [
        {
          name: 'check for "official video" in file names',
          type: TaskType.FUNCTION,
          machines: 'inherit',
          function: async () => {
            const workoutMusicDir = path.join(
              process.env['BASE_SYNC_DIR']!,
              'SyncPhone/Music/Workout Music'
            );
            const musicDirContents = await fsPromises.readdir(workoutMusicDir, {
              withFileTypes: true,
            });
            const matchingFiles = musicDirContents
              .filter((f) => !f.isDirectory())
              .map((f) => f.name)
              .filter((fname) => /official video/i.test(fname));
            if (matchingFiles.length !== 0) {
              throw new Error(`${matchingFiles.length} files contain "Official Video"`);
            }
          },
        },
        // TODO: check for duplicate files with different extensions
      ],
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
  machineConfig: MachineMatchConfig,
  currentMachine: string
): boolean {
  return (
    task.machines === 'inherit' ||
    task.machines.some((machineName) => machineConfig[machineName]?.test(currentMachine))
  );
}

// convert a task from config to tasks that listr can use
function configTaskToListrTask(
  task: ConfigTask,
  machineConfig: MachineMatchConfig,
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
    case TaskType.FUNCTION:
      return {
        title: task.name,
        enabled: () => shouldRunForMachine(task, machineConfig, currentMachine),
        task: task.function,
      };
  }
}

// this machine's name
const machineName = os.hostname();
console.log(`Running for machine '${chalk.green(machineName)}'`);

// TODO: read and validate config (all machine names match, etc.)

// set any configured env vars
if (config.environment) {
  for (const [key, value] of Object.entries(config.environment)) {
    process.env[key] = value;
  }
}

const tasks: Listr = new Listr(
  config.tasks.map((task) => configTaskToListrTask(task, config.machines, machineName)),
  { exitOnError: false }
);

tasks
  .run()
  .then(() => {
    console.log();
    console.log('no errors!');
  })
  .catch((err) => {
    // this error has a list of the errors from any failed tasks
    console.error();
    console.error(chalk.red(`${err.errors.length} task(s) had an error!`));
  });
