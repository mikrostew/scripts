#!/usr/bin/env ts-node

// TODO: split this file up, since it's starting to get large and unwieldy
// (in its own repo)

import fs from 'fs';
import { promises as fsPromises } from 'fs';
import os from 'os';
import path from 'path';

import chalk from 'chalk';
import execa from 'execa';
import Listr, { ListrContext, ListrTask, ListrTaskResult } from 'listr';
import which from 'which';

import {
  TaskType,
  Config,
  MachineSpec,
  ConfigTask,
  KillProcessTask,
  HomebrewTask,
  HomebrewPackage,
  VoltaPackageTask,
  VoltaPackage,
  ExecTask,
  ExecAndSaveTask,
  TaskGroup,
  FunctionTask,
  RepoUpdateTask,
  RepoOptions,
  MachineMatchConfig,
  FileCheck,
} from 'good-morning';

// add things to this, to display after the tasks are run
const FINAL_OUTPUT: string[] = [];

// sleep for the input number of milliseconds
function sleep(millis: number) {
  return new Promise((resolve) => setTimeout(resolve, millis));
}

// TODO: move this config to a separate file (and add CLI option for file path)
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
      function: async () => {
        // try to get it from the input arg, otherwise prompt
        if (typeof process.env['LDAP_PASS'] !== 'undefined') {
          // it's already there, so we're good
        } else {
          const { stdout } = await execa('security', [
            'find-generic-password',
            '-ga',
            'ldap_pass',
            '-w',
          ]);
          process.env['LDAP_PASS'] = stdout.trim();
        }
      },
    },

    {
      name: 'Kill Processes',
      type: TaskType.GROUP,
      machines: ['homeLaptop', 'workLaptop', 'workVM'],
      tasks: [
        {
          name: 'all laptops',
          type: TaskType.KILL_PROC,
          // things to kill on both laptops
          machines: ['homeLaptop', 'workLaptop'],
          processes: [
            'Activity Monitor',
            'zoom.us',
            'App Store',
            'Discord',
            'Microsoft Word',
            'obs',
          ],
        },
        {
          name: 'work laptop',
          type: TaskType.KILL_PROC,
          machines: ['workLaptop'],
          processes: ['Outlook', 'Microsoft Error Reporting', 'Slack', 'Microsoft Teams'],
        },
      ],
    },

    {
      name: 'Check XCode path',
      type: TaskType.FUNCTION,
      machines: ['homeLaptop', 'workLaptop'],
      function: async () => {
        const { stdout, stderr } = await execa('xcode-select', ['--print-path']);
        if (!stdout) {
          throw new Error(`Could not get current XCode path\nstderr='${stderr}'`);
        }
        if (stdout.trim() !== '/Applications/Xcode.app/Contents/Developer') {
          await execa('send-passwd-for-sudo', [
            process.env['LDAP_PASS']!,
            'sudo',
            'xcode-select',
            '-s',
            '/Applications/Xcode.app/Contents/Developer',
          ]);
          // recheck this
          const { stdout, stderr } = await execa('xcode-select', ['--print-path']);
          if (!stdout) {
            throw new Error(`Could not get updated XCode path, stderr=${stderr}`);
          }
          if (stdout.trim() !== '/Applications/Xcode.app/Contents/Developer') {
            throw new Error(`Could not change XCode path\nstdout='${stdout}'\nstderr='${stderr}'`);
          }
        }
      },
    },

    {
      name: 'Homebrew',
      type: TaskType.GROUP,
      machines: ['homeLaptop', 'workLaptop'],
      tasks: [
        {
          name: 'common',
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
          name: 'work laptop',
          type: TaskType.HOMEBREW,
          machines: ['workLaptop'],
          packages: [{ name: 'mysql', executable: 'mysql' }],
        },
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
      name: 'Rust',
      type: TaskType.EXEC,
      machines: ['homeLaptop', 'workLaptop', 'workVM'],
      command: 'rustup',
      args: ['update'],
    },

    {
      name: 'Downloads',
      type: TaskType.GROUP,
      machines: ['homeLaptop', 'workLaptop'],
      tasks: [
        {
          name: 'Moment garden pics & videos',
          type: TaskType.EXEC,
          machines: 'inherit',
          command: 'moment-garden-download',
          args: [],
        },
        {
          name: 'Audio playlists from YT',
          type: TaskType.EXEC,
          machines: 'inherit',
          command: 'download-yt-audio-playlists',
          args: [],
        },
        {
          name: 'Video playlists from YT',
          type: TaskType.EXEC,
          machines: 'inherit',
          command: 'download-yt-video-playlists',
          args: [],
        },
      ],
    },

    {
      name: 'Misc Checks',
      type: TaskType.GROUP,
      machines: ['homeLaptop', 'workLaptop', 'workVM'],
      tasks: [
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
        // TODO: check that syncthing is not paused, using the API
        // TODO: check that rpi is connected using syncthing API
        {
          name: 'Check for sync conflict files',
          type: TaskType.GROUP,
          machines: ['homeLaptop', 'workLaptop'],
          tasks: [
            'SyncAudio',
            'SyncCamera',
            'SyncDocs',
            'SyncImages',
            'SyncPhone',
            'SyncVideo',
          ].map((dir) => syncConflictCheck(dir)),
        },
        {
          name: 'Cleanup shivs',
          type: TaskType.EXEC,
          machines: ['workLaptop', 'workVM'],
          command: 'cleanup-shivs',
          args: [process.env['LDAP_PASS']!],
        },
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
      ],
    },

    {
      name: 'Music Files',
      type: TaskType.GROUP,
      machines: ['homeLaptop', 'workLaptop'],
      tasks: [
        {
          name: 'Singalong',
          type: TaskType.GROUP,
          machines: 'inherit',
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
          name: 'Workout',
          type: TaskType.GROUP,
          machines: 'inherit',
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
      ],
    },

    // check for VPN connection, and block following tasks until connected
    {
      name: 'Block until connected to VPN...',
      type: TaskType.FUNCTION,
      machines: ['workLaptop'],
      function: async () => {
        // timeout after 2 minutes, (2 minutes * 60 sec/min) / (5 sec/attempt) = 24 attempts
        const timeoutMinutes = 2;
        const timeoutDelaySeconds = 5;
        const totalAttempts = (timeoutMinutes * 60) / timeoutDelaySeconds;

        let numAttempts = 0;
        for (;;) {
          try {
            // ping once, with a 1 second timeout
            // (returns non-zero on failure, so execa throws)
            await execa('ping', ['-c1', '-t1', 'tools.corp.linkedin.com']);
            // if successful, we're good
            break;
          } catch {
            if (numAttempts >= totalAttempts) {
              throw new Error(`Timed out after ${timeoutMinutes} minutes`);
            }
            // ping failed, wait and try again
            // (if ping times out, this will be 1 second longer - could do setInterval but whatever)
            await sleep(timeoutDelaySeconds * 1000);
            numAttempts++;
          }
        }
      },
    },

    {
      name: 'Engtools',
      type: TaskType.GROUP,
      machines: ['workLaptop', 'workVM'],
      tasks: [
        {
          name: 'engtools update for laptop',
          type: TaskType.EXEC,
          machines: ['workLaptop'],
          command: 'brew',
          args: ['engtools', 'update'],
        },
        {
          name: 'engtools install for laptop',
          type: TaskType.EXEC,
          machines: ['workLaptop'],
          command: 'send-passwd-for-sudo',
          args: [process.env['LDAP_PASS']!, 'brew', 'engtools', 'install'],
        },
        {
          name: 'engtools for VM',
          type: TaskType.EXEC,
          machines: ['workVM'],
          command: 'send-passwd-for-sudo',
          args: [process.env['LDAP_PASS']!, 'sudo', 'yum', 'install', 'usr-local-linkedin-dist'],
        },
      ],
    },

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

    {
      name: 'Open pages',
      type: TaskType.GROUP,
      machines: ['workLaptop', 'homeLaptop'],
      tasks: [
        {
          name: 'blog',
          type: TaskType.EXEC,
          machines: ['workLaptop'],
          command: 'open',
          args: [
            'https://docs.google.com/document/d/1XQskTjmpzn7-SI7B4e0aNYy3gLE5lTfb9IC67rPN53c/edit#',
          ],
        },
      ],
    },

    {
      name: 'Add after-task outputs',
      type: TaskType.GROUP,
      machines: ['workLaptop', 'homeLaptop', 'workVM'],
      tasks: [
        {
          name: 'Upcoming Dates',
          type: TaskType.FUNCTION,
          machines: 'inherit',
          function: async () => {
            const { stdout } = await execa('upcoming-dates.ts');
            FINAL_OUTPUT.push('', stdout, '');
          },
        },
        {
          name: 'Current Priorities',
          type: TaskType.FUNCTION,
          machines: 'inherit',
          function: async () => {
            const { stdout } = await execa('current-priorities');
            FINAL_OUTPUT.push('', stdout, '');
          },
        },
        {
          name: 'Work Reminders',
          type: TaskType.FUNCTION,
          machines: ['workLaptop'],
          function: () => {
            FINAL_OUTPUT.push('', 'Reminders', ' - setup your Slack status now!');
          },
        },
      ],
    },
  ],
};

// TODO: all this stuff should go in the library

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
    {
      match: /official.*(video|audio)/i,
      errorMsg: '{} official audio/video',
    },
    {
      match: /rename/i,
      errorMsg: '{} (rename)',
    },
    {
      match: /remix/i,
      errorMsg: '{} remix',
    },
    {
      match: /lyric/i,
      errorMsg: '{} lyric',
    },
    {
      match: /\(audio\)/i,
      errorMsg: '{} (audio)',
    },
    {
      match: /visuali[sz]er/i,
      errorMsg: '{} visualizer',
    },
    {
      match: /hq/i,
      errorMsg: '{} hq',
    },
    // https://www.grammarly.com/blog/capitalization-in-the-titles/
    // (prepositions, articles, and conjunctions are not capitalized)
    {
      match: (fname: string) =>
        fname
          .split('-')
          .some(
            (part) =>
              / (Of|A|And|To|The|For|Or|In|On|Out|Up) /.test(part.trim()) &&
              !/The A/.test(part.trim())
          ),
      errorMsg: '{} Of/A/And/To/The/For/Or/In/On/Out/Up',
    },
    {
      match: (fname: string) =>
        fname.split(' ').some((word) => /^[A-Z]{2,}$/.test(word) && !/II/.test(word)),
      errorMsg: '{} all caps',
    },
    {
      // could negate this regex with negative look-ahead, like /^(?!.* - )/, but I will definitely forget that syntax
      // (see https://stackoverflow.com/a/1538524 for instance)
      match: (fname: string) => !/ - /.test(fname),
      errorMsg: '{} no dashes',
    },
    {
      match: /best quality/i,
      errorMsg: '{} best quality',
    },
    {
      match: '  ',
      errorMsg: '{} extra spaces',
    },
    {
      match: (fname: string) =>
        fname.split('-').some((part) => /^[']/.test(part.trim()) || /[']$/.test(part.trim())),
      errorMsg: '{} start/end with quote mark',
    },
  ];

  const failedFiles: string[] = [];
  const errors = fileChecks
    .map((check: FileCheck) => {
      let matchingFiles;
      // what will we use to match?
      const howToMatch = check.match;
      if (typeof howToMatch === 'function') {
        matchingFiles = fileNames.filter(howToMatch);
      } else if (typeof howToMatch === 'string') {
        matchingFiles = fileNames.filter((fname: string) => fname.indexOf(howToMatch) >= 0);
      } else if (howToMatch instanceof RegExp) {
        matchingFiles = fileNames.filter((fname: string) => howToMatch.test(fname));
      } else {
        throw new Error(`unknown type of file check: ${JSON.stringify(check)}`);
      }

      if (matchingFiles.length > 0) {
        // add matching files to array
        failedFiles.push(...matchingFiles);
        return check.errorMsg.replace('{}', `${matchingFiles.length}`);
      }
    })
    .filter((error) => error !== undefined);

  if (errors.length > 0) {
    ctx[contextPropName] = true;
    // open the directory in Finder to fix these
    await execa('open', [dirPath]);
    // show error summary, along with file names
    throw new Error(`${errors.join(', ')}\n${failedFiles.join('\n')}`);
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
        title: task.name,
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

// TODO: all this stuff should go in the library

const args = process.argv.slice(2);
// input ldap_pass as an optional argument to this script
if (args[0] !== undefined) {
  process.env['LDAP_PASS'] = args[0];
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

// TODO: input the initial context with env vars setup
tasks
  .run()
  .then(() => {
    console.log();
    console.log('no errors!');
  })
  .catch((err) => {
    // this error has a list of the errors from any failed tasks
    console.log();
    console.log(chalk.red(`${err.errors.length} task(s) had an error!`));
    console.log();
    // reprint the errors
    for (let i = 0; i < err.errors.length; i++) {
      console.log(`Error #${i + 1}`);
      console.log(err.errors[i]);
      console.log();
    }
  })
  .then(() => {
    // things after the tasks
    console.log(FINAL_OUTPUT.join('\n'));
    console.log(chalk.green('\nGood Morning!\n'));
  });
