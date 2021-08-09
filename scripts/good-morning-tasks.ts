#!/usr/bin/env ts-node

// TODO: split this file up, since it's starting to get large and unwieldy
// (maybe in its own repo?)

import { promises as fsPromises } from 'fs';
import path from 'path';
import os from 'os';

import chalk from 'chalk';
import execa from 'execa';
import Listr, { ListrContext, ListrTask, ListrTaskResult } from 'listr';
import which from 'which';

// sleep for the input number of milliseconds
function sleep(millis: number) {
  return new Promise((resolve) => setTimeout(resolve, millis));
}

enum TaskType {
  KILL_PROC = 'kill-proc',
  HOMEBREW = 'homebrew',
  VOLTA_PACKAGE = 'volta-package',
  EXEC = 'exec',
  EXEC_AND_SAVE = 'exec-and-save',
  GROUP = 'group',
  FUNCTION = 'function',
  REPO_UPDATE = 'repo-update',
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
  | FunctionTask
  | RepoUpdateTask;

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
  name: string;
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
  function: (ctx?: ListrContext) => void | ListrTaskResult<any>;
}

// update a repository
interface RepoUpdateTask {
  name: string;
  type: TaskType.REPO_UPDATE;
  machines: MachineSpec;
  directory: string;
  options: RepoOptions[];
}

type RepoOptions = 'pull&rebase' | 'push' | 'yarn';

// machine names map to the keys of this object
// (so that adding a task is easy, because it's done often,
//  but adding a machine is harder, and is done less often)
interface MachineMatchConfig {
  [key: string]: RegExp;
}

// for checking file names
interface FileCheck {
  // I could maybe simplify this to just be string | RegExp, but that' not expressive enough
  match: ((fileName: string) => boolean) | RegExp | string;
  // string with '{}' placeholder, like "{} bad characters" (like what Rust does)
  errorMsg: `${any}{}${any}`;
  // TODO: some way to list the failed files on the command line, maybe a command string?
}

// TODO: move this config to a separate file
const config: Config = {
  environment: {
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
    // for the work laptop, need to get the password first (if it is not passed in as an argument)
    {
      type: TaskType.FUNCTION,
      name: 'Save LDAP password',
      machines: ['workLaptop'],
      function: async (ctx) => {
        // try to get it from the input arg, otherwise prompt
        if (process.env['LDAP_PASS'] !== undefined && process.env['LDAP_PASS'] !== '') {
          ctx['ldap_pass'] = process.env['LDAP_PASS'];
        } else {
          const { stdout } = await execa('security', [
            'find-generic-password',
            '-ga',
            'ldap_pass',
            '-w',
          ]);
          ctx['ldap_pass'] = stdout.trim();
        }
      },
    },

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
      name: 'Check for sync conflict files',
      type: TaskType.GROUP,
      machines: ['homeLaptop', 'workLaptop'],
      tasks: ['SyncAudio', 'SyncCamera', 'SyncDocs', 'SyncImages', 'SyncPhone', 'SyncVideo'].map(
        (dir) => syncConflictCheck(dir)
      ),
    },

    {
      name: 'Check singalong music files',
      type: TaskType.GROUP,
      machines: ['homeLaptop', 'workLaptop'],
      tasks: [
        renameRenameFiles('inherit', 'SyncPhone/Music/Singalong'),
        // TODO: extract this object like I did with the one above ^^
        {
          name: 'file name checks',
          type: TaskType.FUNCTION,
          machines: 'inherit',
          function: (ctx) =>
            fileNameChecks(
              ctx,
              path.join(process.env['BASE_SYNC_DIR']!, 'SyncPhone/Music/Singalong'),
              'singalong-music-errors'
            ),
        },
        // TODO: check for duplicate files with different extensions
        // TODO: if all checks pass, write the list to music playlist repo (src/gh/playlists)
        // {
        //   name: 'Export singalong music playlist',
        //   type: TaskType.FUNCTION,
        //   machines: ['homeLaptop', 'workLaptop'],
        //   // TODO
        //   function: () => {},
        // },
      ],
    },
    {
      name: 'Check workout music files',
      type: TaskType.GROUP,
      machines: ['homeLaptop', 'workLaptop'],
      tasks: [
        renameRenameFiles('inherit', 'SyncPhone/Music/Workout Music'),
        // TODO: extract this object like I did with the one above ^^
        {
          name: 'file name checks',
          type: TaskType.FUNCTION,
          machines: 'inherit',
          function: (ctx) =>
            fileNameChecks(
              ctx,
              path.join(process.env['BASE_SYNC_DIR']!, 'SyncPhone/Music/Workout Music'),
              'workout-music-errors'
            ),
        },
        // TODO: check for duplicate files with different extensions
        // TODO: if all checks pass, write the list to music playlist repo (src/gh/playlists)
        // {
        //   name: 'Export workout music playlist',
        //   type: TaskType.FUNCTION,
        //   machines: ['homeLaptop', 'workLaptop'],
        //   // TODO
        //   function: () => {},
        // },
      ],
    },

    // TODO: check that rpi is connected using syncthing API
    // TODO: check that syncthing is not paused, using the API

    // TODO: cleanup shivs

    {
      name: 'Free space check',
      type: TaskType.FUNCTION,
      machines: ['homeLaptop', 'workLaptop'],
      function: async () => {
        const { stdout } = await execa('df', ['-h']);
        const mainVolumeLine = stdout.match(/.*\/System\/Volumes\/Data\n/);
        if (mainVolumeLine === null) {
          throw new Error(`Could not parse free space from ${stdout}`);
        }
        const splitLine = mainVolumeLine[0]?.split(' ').filter((s) => s !== '');
        if (splitLine === undefined) {
          throw new Error(`Could not parse free space from line ${mainVolumeLine}`);
        }
        const percentFreeSpace = parseInt(splitLine[4] || '', 10);

        if (percentFreeSpace > 80) {
          throw new Error(`${percentFreeSpace} free space left (over 80%)`);
        }
      },
    },

    // check for VPN connection, and block following tasks until connected
    {
      name: 'Block until connected to VPN...',
      type: TaskType.FUNCTION,
      machines: ['workLaptop'],
      function: async () => {
        for (;;) {
          try {
            // ping once
            // (returns non-zero on failure, so execa throws)
            await execa('ping', ['-c1', 'tools.corp.linkedin.com']);
            // if successful, we're good
            break;
          } catch {
            // ping failed, wait 5 seconds and try again
            await sleep(5 * 1000);
          }
        }
      },
    },

    // TODO: homebrew and engtools stuff for work machines

    // update repositories
    {
      name: 'Update repositories',
      type: TaskType.GROUP,
      machines: ['homeLaptop', 'workLaptop', 'workVM'],
      tasks: [
        {
          name: 'dotfiles',
          type: TaskType.REPO_UPDATE,
          machines: ['homeLaptop', 'workLaptop', 'workVM'],
          directory: path.join(os.homedir(), 'src/gh/dotfiles'),
          options: ['pull&rebase', 'push', 'yarn'],
        },
        {
          name: 'badash',
          type: TaskType.REPO_UPDATE,
          machines: ['homeLaptop', 'workLaptop', 'workVM'],
          directory: '/usr/local/lib/badash/',
          options: ['pull&rebase'],
        },
        {
          name: 'voyager-web',
          type: TaskType.REPO_UPDATE,
          machines: ['workLaptop', 'workVM'],
          directory: path.join(os.homedir(), 'src/li/voyager-web'),
          options: ['pull&rebase'],
        },
        {
          name: 'work blog',
          type: TaskType.REPO_UPDATE,
          machines: ['workLaptop'],
          directory: path.join(os.homedir(), 'src/li/blog'),
          options: ['pull&rebase'],
        },
        {
          name: 'node-acid-data-producers',
          type: TaskType.REPO_UPDATE,
          machines: ['workLaptop'],
          directory: path.join(os.homedir(), 'src/li/node-acid-data-producers'),
          options: ['pull&rebase'],
        },
      ],
    },
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

async function repoTask(directory: string, options: RepoOptions[]): Promise<void> {
  // what is the default branch for the repo?
  const defaultBranch = await getRepoDefaultBranch(directory);

  // save current branch
  const originalBranch = await currentGitBranch(directory);
  try {
    // run these tasks on the default branch
    if (originalBranch !== defaultBranch) {
      await gitCheckout(directory, defaultBranch);
    }

    // do things based on the options
    // (using contains should be fine here, these options are <5 things)
    if (options.includes('pull&rebase')) {
      await gitPullRebase(directory, defaultBranch);
    }
    if (options.includes('push')) {
      await gitPush(directory);
    }
    if (options.includes('yarn')) {
      await yarnInstall(directory);
    }
  } finally {
    // try to get back to the original branch
    if (originalBranch !== defaultBranch) {
      await gitCheckout(directory, originalBranch);
    }
  }
}

// is the default branch main or master?
async function getRepoDefaultBranch(directory: string): Promise<string> {
  // check if repo uses main or master
  try {
    await execa('git', ['show-ref', '--verify', '--quiet', 'refs/heads/main'], { cwd: directory });
    return 'main';
  } catch {
    // not main
  }
  try {
    await execa('git', ['show-ref', '--verify', '--quiet', 'refs/heads/master'], {
      cwd: directory,
    });
    return 'master';
  } catch {
    // not master either
  }
  throw new Error("default branch is not 'main' or 'master'");
}

async function currentGitBranch(directory: string): Promise<string> {
  try {
    const { stdout } = await execa('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd: directory,
    });
    return stdout.trim();
  } catch (err) {
    // short message is not helpful (just shows command failed), but stderr has useful info
    const msg = err.stderr
      .split('\n')
      .map((s: string) => s.trim())
      .join(' ');
    throw new Error(`Error getting current branch: ${msg}`);
  }
}

async function gitCheckout(directory: string, branch: string): Promise<void> {
  try {
    const { stdout } = await execa('git', ['checkout', branch], {
      cwd: directory,
    });
  } catch (err) {
    // short message is not helpful (just shows command failed), but stderr has useful info
    const msg = err.stderr
      .split('\n')
      .map((s: string) => s.trim())
      .join(' ');
    throw new Error(`Error checking out branch ${branch}: ${msg}`);
  }
}

async function gitPullRebase(directory: string, branch: string): Promise<void> {
  try {
    await execa('git', ['fetch', '--all', '--prune'], { cwd: directory });
    await execa('git', ['rebase', `origin/${branch}`], { cwd: directory });
  } catch (err) {
    // short message is not helpful (just shows command failed), but stderr has useful info
    const msg = err.stderr
      .split('\n')
      .map((s: string) => s.trim())
      .join(' ');
    throw new Error(`Error pulling and rebasing branch ${branch}: ${msg}`);
  }
}

async function gitPush(directory: string): Promise<void> {
  try {
    await execa('git', ['push'], { cwd: directory });
  } catch (err) {
    // short message is not helpful (just shows command failed), but stderr has useful info
    const msg = err.stderr
      .split('\n')
      .map((s: string) => s.trim())
      .join(' ');
    throw new Error(`Error pushing: ${msg}`);
  }
}

async function yarnInstall(directory: string): Promise<void> {
  try {
    await execa('yarn', ['install'], { cwd: directory });
  } catch (err) {
    // short message is not helpful (just shows command failed), but stderr has useful info
    const msg = err.stderr
      .split('\n')
      .map((s: string) => s.trim())
      .join(' ');
    throw new Error(`Error running 'yarn install': ${msg}`);
  }
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

// rename files containing '(rename)'
function renameRenameFiles(machineSpec: MachineSpec, syncDir: string): ConfigTask {
  return {
    name: 'remove (rename) from file names',
    type: TaskType.FUNCTION,
    machines: machineSpec,
    function: async () => {
      const dirPath = path.join(process.env['BASE_SYNC_DIR']!, syncDir);
      const fileNames = (
        await fsPromises.readdir(dirPath, {
          withFileTypes: true,
        })
      )
        .filter((f) => !f.isDirectory())
        .map((dirent) => dirent.name);
      for (const fileName of fileNames) {
        if (/rename/i.test(fileName)) {
          // remove the ' (rename)' from the file, which I guess will throw if this doesn't work?
          const newName = fileName.replace(' (rename)', '');
          await fsPromises.rename(path.join(dirPath, fileName), path.join(dirPath, newName));
        }
      }
    },
  };
}

// check the files in the input directory, setting the contextPropName in the context to true on error
async function fileNameChecks(
  ctx: ListrContext,
  dirPath: string,
  contextPropName: string
): Promise<void> {
  const dirContents = await fsPromises.readdir(dirPath, {
    withFileTypes: true,
  });
  const fileNames = dirContents
    .filter((f) => !f.isDirectory())
    .map((f) => f.name)
    .filter((name) => name !== '.DS_Store');

  const fileChecks: FileCheck[] = [
    //   find . | sort | grep -i 'official.*\(video\|audio\)'
    {
      match: /official.*(video|audio)/i,
      errorMsg: '{} official audio/video',
    },
    //   find . | sort | grep -i 'rename'
    {
      match: /rename/i,
      errorMsg: '{} (rename)',
    },
    //   find . | sort | grep -i 'remix'
    {
      match: /remix/i,
      errorMsg: '{} remix',
    },
    //   find . | sort | grep -i 'lyric'
    {
      match: /lyric/i,
      errorMsg: '{} lyric',
    },
    //   find . | sort | grep -i 'visuali[sz]er'
    {
      match: /visuali[sz]er/i,
      errorMsg: '{} visualizer',
    },
    //   find . | sort | grep -i 'hq'
    {
      match: /hq/i,
      errorMsg: '{} hq',
    },
    // https://www.grammarly.com/blog/capitalization-in-the-titles/
    // (prepositions, articles, and conjunctions are not capitalized)
    //   find . | sort | grep -v 'The A' | grep -v II | grep '[^-] \(Of\|A\|And\|To\|The\|For\|Or\|In\|On\|Out\|Up\) '
    {
      match: (fname: string) =>
        fname
          .split('-')
          .some(
            (part) =>
              / (Of|A|And|To|The|For|Or|In|On|Out|Up) /.test(part.trim()) &&
              !/The A/.test(part.trim()) &&
              !/II/.test(part.trim())
          ),
      errorMsg: '{} Of/A/And/To/The/For/Or/In/On/Out/Up',
    },
    //   find . | sort | grep [A-Z][A-Z][A-Z]*
    {
      match: (fname: string) => fname.split(' ').some((word) => /^[A-Z]{2,}$/.test(word)),
      errorMsg: '{} all caps',
    },
    //   find . | sort | grep -v " - "
    {
      // could negate this regex with negative look-ahead, like /^(?!.* - )/, but I will definitely forget that syntax
      // (see https://stackoverflow.com/a/1538524 for instance)
      match: (fname: string) => !/ - /.test(fname),
      errorMsg: '{} no dashes',
    },
    //   find . | sort | grep -i 'best quality'
    {
      match: /best quality/i,
      errorMsg: '{} best quality',
    },
    //   find . | sort | grep '  '
    {
      match: '  ',
      errorMsg: '{} extra spaces',
    },
  ];

  const errors = fileChecks
    .map((check: FileCheck) => {
      let numMatchingFiles;
      // what will we use to match?
      const howToMatch = check.match;
      if (typeof howToMatch === 'function') {
        numMatchingFiles = fileNames.filter(howToMatch).length;
      } else if (typeof howToMatch === 'string') {
        numMatchingFiles = fileNames.filter(
          (fname: string) => fname.indexOf(howToMatch) >= 0
        ).length;
      } else if (howToMatch instanceof RegExp) {
        numMatchingFiles = fileNames.filter((fname: string) => howToMatch.test(fname)).length;
      } else {
        throw new Error(`unknown type of file check: ${JSON.stringify(check)}`);
      }

      if (numMatchingFiles > 0) {
        // TODO: open a terminal and run one of the find/grep combos above to show the files
        return check.errorMsg.replace('{}', `${numMatchingFiles}`);
      }
    })
    .filter((error) => error !== undefined);

  if (errors.length > 0) {
    ctx[contextPropName] = true;
    // open the directory in Finder to fix these
    await execa('open', [dirPath]);
    throw new Error(errors.join(', '));
  }
}

// generate task to check for sync-conflict files in the input sync dir
function syncConflictCheck(syncDirName: string): FunctionTask {
  return {
    name: `check ${syncDirName} files`,
    type: TaskType.FUNCTION,
    machines: 'inherit',
    function: async () => {
      const syncDirPath = path.join(process.env['BASE_SYNC_DIR']!, syncDirName);
      const { stdout } = await execa('find', [syncDirPath, '-iname', '*sync-conflict*']);
      if (stdout.length > 0) {
        throw new Error(`Found ${stdout.split('\n').length} sync-conflict files`);
      }
    },
  };
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
        title: task.name,
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
    case TaskType.REPO_UPDATE:
      return {
        title: task.name,
        enabled: () => shouldRunForMachine(task, machineConfig, currentMachine),
        task: () => repoTask(task.directory, task.options),
      };
  }
}

// input ldap_pass as an optional argument to this script
const args = process.argv.slice(2);
const ldapPass = args[0];
process.env['LDAP_PASS'] = ldapPass;

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
