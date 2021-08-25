#!/usr/bin/env ts-node

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
} from 'good-morning';

// add things to this, to display after the tasks are run
const FINAL_OUTPUT: string[] = [];

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
