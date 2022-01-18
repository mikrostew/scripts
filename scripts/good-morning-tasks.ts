#!/usr/bin/env ts-node

// TODO: I'd like to do this, but I'm on node 12.x - probably should upgrade
//import { readdir } from 'fs/promises';
import { promises as fsPromises } from 'fs';
import os from 'os';
import path from 'path';

import execa from 'execa';
import {
  TaskType,
  Config,
  renameRenameFiles,
  fileNameChecks,
  syncConflictCheck,
  sleep,
  runTasks,
} from '@mikrostew/good-morning';

// add things to this, to display after the tasks are run
const FINAL_OUTPUT: string[] = [];

// TODO: add an 'all' keyword?
const allMachines = ['homeLaptop', 'workLaptop', 'workVM'];
const laptopMachines = ['homeLaptop', 'workLaptop'];
const workMachines = ['workLaptop', 'workVM'];

const config: Config = {
  environment: {
    BASE_SYNC_DIR: /(MacBook-Air|Michaels-Air)/i.test(os.hostname())
      ? process.env['HOME']!
      : '/usr/local/SyncThing',
  },
  // TODO: rename this to machineMap?
  machines: {
    homeLaptop: /(MacBook-Air|Michaels-Air)/i,
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
      machines: allMachines,
      tasks: [
        {
          name: 'all laptops',
          type: TaskType.KILL_PROC,
          // things to kill on both laptops
          machines: laptopMachines,
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
      machines: laptopMachines,
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

    // {
    //   name: 'Restore homebrew symlink',
    //   type: TaskType.FUNCTION,
    //   machines: laptopMachines,
    //   function: async () => {
    //     const brewSymlinkLocation = '/usr/local/bin/brew';
    //     const brewBinaryLocation = '/usr/local/Homebrew/bin/brew';
    //     // if I have changed the symlink, change it so it points to the binary
    //     // normally this is symlinked to /usr/local/Homebrew/bin/brew
    //     // I may have changed that to symlink to scripts/brew-noop
    //     const linkStat = await fsPromises.lstat(brewSymlinkLocation);
    //     if (linkStat.isSymbolicLink()) {
    //       // if it's linked to the original location, ok, otherwise change it back
    //       const target = await fsPromises.readlink(brewSymlinkLocation);
    //       if (target !== brewBinaryLocation) {
    //         await fsPromises.unlink(brewSymlinkLocation);
    //         await fsPromises.symlink(brewBinaryLocation, brewSymlinkLocation);
    //       }
    //     } else {
    //       throw new Error(`'${brewSymlinkLocation}' is not a symlink`);
    //     }
    //   },
    // },

    {
      name: 'Check homebrew things',
      type: TaskType.GROUP,
      machines: laptopMachines,
      tasks: [
        {
          name: 'Brew outdated',
          type: TaskType.FUNCTION,
          machines: 'inherit',
          function: async () => {
            const brewOutdatedStdout = (await execa('brew', ['outdated'])).stdout;
            const outdatedPackages = brewOutdatedStdout
              .trim()
              .split('\n')
              .filter((s) => s !== '');
            const numOutdated = outdatedPackages.length;
            if (numOutdated > 0) {
              throw new Error(
                `'brew outdated' output:\n${brewOutdatedStdout}\nRun 'brew upgrade' to update these ${numOutdated} outdated packages: ${outdatedPackages.join(
                  ', '
                )}`
              );
            }
          },
        },
        {
          name: 'Brew doctor',
          type: TaskType.FUNCTION,
          machines: 'inherit',
          // this fails because of the check for config scripts (LI has some in ULL/ECL), so skip that one
          function: async () => {
            // get a list of all checks, then skip the config check
            const brewChecks = (await execa('brew', ['doctor', '--list-checks'])).stdout
              .split('\n')
              .map((c) => c.trim())
              .filter((c) => c !== 'check_for_config_scripts');
            return execa('brew', ['doctor', ...brewChecks]);
          },
        },
      ],
    },

    {
      name: 'Homebrew',
      type: TaskType.GROUP,
      machines: laptopMachines,
      tasks: [
        {
          name: 'common',
          type: TaskType.HOMEBREW,
          machines: laptopMachines,
          packages: [
            'bats-core',
            'chruby',
            'coreutils',
            'expect',
            'ffmpeg',
            'gh',
            'gimp',
            'git',
            'git-gui',
            'htop',
            'imagemagick',
            'jq',
            'macvim',
            'moreutils',
            'pstree',
            'ruby-install',
            'terminal-notifier',
            'tidy-html5',
            'tmux',
            'tree',
            'watch',
            'wget',
            'youtube-dl',
          ],
        },
        {
          name: 'work laptop',
          type: TaskType.HOMEBREW,
          machines: ['workLaptop'],
          packages: ['mysql'],
        },
      ],
    },

    {
      type: TaskType.VOLTA_PACKAGE,
      machines: allMachines,
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
      machines: allMachines,
      command: 'rustup',
      args: ['update'],
    },

    {
      name: 'Downloads',
      type: TaskType.GROUP,
      machines: laptopMachines,
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
      machines: allMachines,
      tasks: [
        {
          name: 'Verify dotfile links are good',
          type: TaskType.EXEC,
          machines: allMachines,
          command: 'verify-dotfile-links',
          args: [path.join(os.homedir(), 'src/gh/dotfiles')],
        },
        {
          name: 'Make sure syncthing is running',
          type: TaskType.EXEC,
          machines: laptopMachines,
          command: 'pgrep',
          args: ['syncthing'],
        },
        // TODO: check that syncthing is not paused, using the API
        // TODO: check that rpi is connected using syncthing API
        {
          name: 'Check for sync conflict files',
          type: TaskType.GROUP,
          machines: laptopMachines,
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
          machines: workMachines,
          command: 'cleanup-shivs',
          args: [process.env['LDAP_PASS']!],
        },
        {
          name: 'Free space check',
          type: TaskType.FUNCTION,
          machines: laptopMachines,
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
              throw new Error(`${percentFreeSpace}% free space left (over 80%)`);
            }
          },
        },
        // check for cluttered Desktop
        // (more than 20 things)
        {
          name: 'Cluttered Desktop',
          type: TaskType.FUNCTION,
          machines: laptopMachines,
          function: async () => {
            const MAX_DESKTOP_ITEMS = 20;
            const desktopPath = path.join(process.env['HOME']!, 'Desktop');
            const filesInDesktop = await fsPromises.readdir(desktopPath);
            if (filesInDesktop.length > MAX_DESKTOP_ITEMS) {
              throw new Error(
                `More than ${MAX_DESKTOP_ITEMS} items in Desktop: found ${filesInDesktop.length}`
              );
            }
          },
        },
        {
          name: 'Uptime',
          type: TaskType.FUNCTION,
          machines: laptopMachines,
          function: async () => {
            const MAX_UPTIME_DAYS = 10;
            const uptimeStdout = (await execa('uptime')).stdout.trim();
            // if the machine has been up less than a day, it will be this format
            const matchedLessThanOneDay = uptimeStdout.match(/[0-9]+:[0-9]+\s*up [0-9]+:[0-9]+,/);
            if (matchedLessThanOneDay) {
              return;
            }
            // will match this if it has been more than one day
            const matchedMultipleDays = uptimeStdout.match(/[0-9]+:[0-9]+\s*up ([0-9]*) days/);
            if (!matchedMultipleDays || !matchedMultipleDays[1]) {
              throw new Error(`'uptime' stdout:\n${uptimeStdout}\nCould not parse uptime output`);
            }
            const numDaysUp = parseInt(matchedMultipleDays[1]);
            if (Number.isNaN(numDaysUp)) {
              throw new Error(
                `'uptime' stdout:\n${uptimeStdout}\nError parsing uptime output, got '${matchedMultipleDays[1]}' days, which is NaN`
              );
            }
            if (numDaysUp > MAX_UPTIME_DAYS) {
              throw new Error(
                `Machine has been up for ${numDaysUp} days (> ${MAX_UPTIME_DAYS}), consider restarting it`
              );
            }
          },
        },
      ],
    },

    // TODO: check projects for TODOs over a specified threshold
    // don't put everything in here, just projects that should actually be a priority
    // can even specify a subdir of a project, or specific file, if I care about only that
    // {
    //   name: 'Project TODOs',
    //   type: TaskType.GROUP,
    //   machines: ['homeLaptop'],
    //   tasks: [
    //     {
    //       type: TaskType.PROJECT_TODOS,
    //       machines: 'inherit',
    //       location: '~/src/gh/dotfiles',
    //       threshold: 20,
    //     },
    //   ],
    // },

    {
      name: 'Music Files',
      type: TaskType.GROUP,
      machines: laptopMachines,
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
            //   machines: laptopMachines,
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
            //   machines: laptopMachines,
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
      machines: workMachines,
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
      machines: allMachines,
      tasks: [
        {
          name: 'dotfiles',
          type: TaskType.REPO_UPDATE,
          machines: allMachines,
          directory: path.join(os.homedir(), 'src/gh/dotfiles'),
          options: ['pull&rebase', 'push', 'yarn'],
        },
        {
          name: 'badash',
          type: TaskType.REPO_UPDATE,
          machines: allMachines,
          directory: '/usr/local/lib/badash/',
          options: ['pull&rebase'],
        },
        {
          name: 'voyager-web',
          type: TaskType.REPO_UPDATE,
          machines: workMachines,
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
      name: 'Open pages - work and home',
      type: TaskType.OPEN_URL,
      machines: laptopMachines,
      url_config: {
        'Volta pnpm support RFC': 'https://github.com/volta-cli/rfcs/pull/46',
      },
    },
    {
      name: 'Open pages - work',
      type: TaskType.OPEN_URL,
      machines: ['workLaptop'],
      url_config: {
        blog: 'https://docs.google.com/document/d/1XQskTjmpzn7-SI7B4e0aNYy3gLE5lTfb9IC67rPN53c/edit#',
        tasks:
          'https://docs.google.com/spreadsheets/d/1PFz8_EXZ4W6Kb-r7wpqSSxhKNTE5Dx7evonVXteFqJQ/edit#gid=0',
        reading:
          'https://docs.google.com/document/d/1QXoiUy-DKZb76nkzxx4V_bqO63C6pdFnqCAeGV9WGYs/edit',
        'acid-tmc-jobs':
          'https://testmanager2.tools.corp.linkedin.com/#/product-details/voyager-web?taskName=send-acid-metrics',
      },
    },

    {
      name: 'Start Apps',
      type: TaskType.GROUP,
      machines: laptopMachines,
      tasks: [
        {
          name: 'work laptop',
          type: TaskType.START_APP,
          machines: ['workLaptop'],
          appPaths: [
            '/Applications/Slack.app/Contents/MacOS/Slack',
            '/Applications/Microsoft Outlook.app/Contents/MacOS/Microsoft Outlook',
          ],
        },
        // TODO: anything for my personal laptop?
      ],
    },

    // {
    //   name: 'Disable homebrew',
    //   type: TaskType.FUNCTION,
    //   machines: laptopMachines,
    //   function: async () => {
    //     const brewSymlinkLocation = '/usr/local/bin/brew';
    //     const brewBinaryLocation = '/usr/local/Homebrew/bin/brew';
    //     const brewNoopLocation = path.resolve(__dirname, 'brew-noop');
    //     // normally this is symlinked to /usr/local/Homebrew/bin/brew
    //     // I'm going to change that to symlink to scripts/brew-noop
    //     await fsPromises.unlink(brewSymlinkLocation);
    //     await fsPromises.symlink(brewNoopLocation, brewSymlinkLocation);
    //   },
    // },

    {
      name: 'Add after-task outputs',
      type: TaskType.GROUP,
      machines: allMachines,
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

const args = process.argv.slice(2);
// input ldap_pass as an optional argument to this script
if (args[0] !== undefined) {
  // TODO: put this in the initial context
  process.env['LDAP_PASS'] = args[0];
}

runTasks(config).then(() => {
  // things after the tasks
  console.log(FINAL_OUTPUT.join('\n'));
});
