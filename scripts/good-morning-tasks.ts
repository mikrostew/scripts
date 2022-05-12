#!/usr/bin/env ts-node
/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { readdir } from 'fs/promises';
import os from 'os';
import path from 'path';

import execa from 'execa';
import {
  Config,
  renameRenameFiles,
  fileNameChecks,
  syncConflictCheck,
  sleep,
  runTasks,
} from '@mikrostew/good-morning';
import {
  exec,
  func,
  group,
  homebrew,
  kill_proc,
  open_url,
  repo_update,
  start_app,
  volta,
} from '@mikrostew/good-morning/lib/plugins';

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
    func('Save LDAP password', ['workLaptop'], async () => {
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
    }),

    group('Kill Processes', allMachines, [
      kill_proc('all laptops', laptopMachines, [
        'Activity Monitor',
        'zoom.us',
        'App Store',
        'Discord',
        'Microsoft Word',
        'obs',
      ]),
      kill_proc(
        'work laptop',
        ['workLaptop'],
        ['Outlook', 'Microsoft Error Reporting', 'Slack', 'Microsoft Teams']
      ),
    ]),

    func('Check XCode path', laptopMachines, async () => {
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
    }),

    group('Check homebrew things', laptopMachines, [
      func('Brew outdated (& upgrade)', 'inherit', async () => {
        const brewOutdatedStdout = (await execa('brew', ['outdated'])).stdout;
        const outdatedPackages = brewOutdatedStdout
          .trim()
          .split('\n')
          .filter((s) => s !== '');
        const numOutdated = outdatedPackages.length;
        // if there are any outdated packages, update them
        if (numOutdated > 0) {
          // sometimes upgrades need sudo
          return execa('send-passwd-for-sudo', [process.env['LDAP_PASS']!, 'brew', 'upgrade']);
        }
      }),
      func('Brew cleanup', 'inherit', async () => {
        // free up some disk space
        return execa('brew', ['cleanup']);
      }),
      func('Brew doctor', 'inherit', async () => {
        // this fails because of the check for config scripts (LI has some in ULL/ECL), so skip that one
        // get a list of all checks, then skip the config check
        const brewChecks = (await execa('brew', ['doctor', '--list-checks'])).stdout
          .split('\n')
          .map((c) => c.trim())
          .filter((c) => c !== 'check_for_config_scripts');
        return execa('brew', ['doctor', ...brewChecks]);
      }),
    ]),

    group('Homebrew', laptopMachines, [
      homebrew('common', laptopMachines, [
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
      ]),
      homebrew('work laptop', ['workLaptop'], ['mysql']),
    ]),

    volta(allMachines, [
      { name: '@11ty/eleventy' },
      { name: 'backstopjs' },
      { name: 'cowsay' },
      { name: 'ember-cli' },
      { name: 'eslint' },
      { name: 'gulp' },
      { name: 'ts-node' },
      { name: 'typescript' },
    ]),

    exec('Rust', allMachines, 'rustup', ['update']),

    group('Downloads', laptopMachines, [
      exec('Moment garden pics & videos', 'inherit', 'moment-garden-download', []),
      exec('Audio playlists from YT', 'inherit', 'download-yt-audio-playlists', []),
      exec('Video playlists from YT', 'inherit', 'download-yt-video-playlists', []),
    ]),

    group('Misc Checks', allMachines, [
      exec('Verify dotfile links are good', allMachines, 'verify-dotfile-links', [
        path.join(os.homedir(), 'src/gh/dotfiles'),
      ]),
      exec('Make sure syncthing is running', laptopMachines, 'pgrep', ['syncthing']),
      // TODO: check that syncthing is not paused, using the API
      // TODO: check that rpi is connected using syncthing API
      group(
        'Check for sync conflict files',
        laptopMachines,
        ['SyncAudio', 'SyncCamera', 'SyncDocs', 'SyncImages', 'SyncPhone', 'SyncVideo'].map((dir) =>
          syncConflictCheck(dir)
        )
      ),
      exec('Lint script files', workMachines, 'lint-scripts', ['scripts/*'], { shell: true }),
      exec('Cleanup shivs', workMachines, 'cleanup-shivs', [process.env['LDAP_PASS']!]),
      func('Disk space check', laptopMachines, async () => {
        const { stdout } = await execa('df', ['-h']);
        const mainVolumeLine = stdout.match(/.*\/System\/Volumes\/Data\n/);
        if (mainVolumeLine === null) {
          throw new Error(`Could not parse disk space from ${stdout}`);
        }
        const splitLine = mainVolumeLine[0]?.split(' ').filter((s) => s !== '');
        if (splitLine === undefined) {
          throw new Error(`Could not parse disk space from line ${mainVolumeLine}`);
        }
        const percentDiskUsed = parseInt(splitLine[4] || '', 10);

        if (percentDiskUsed > 80) {
          throw new Error(
            `${percentDiskUsed}% disk used (over 80%). Run something like 'dir-sizes /Applications/* /Users/$USER/* /usr/*' to see disk usage info.`
          );
        }
      }),
      // check for cluttered Desktop
      // (more than 20 things)
      func('Cluttered Desktop', laptopMachines, async () => {
        const MAX_DESKTOP_ITEMS = 20;
        const desktopPath = path.join(process.env['HOME']!, 'Desktop');
        const filesInDesktop = await readdir(desktopPath);
        if (filesInDesktop.length > MAX_DESKTOP_ITEMS) {
          throw new Error(
            `More than ${MAX_DESKTOP_ITEMS} items in Desktop: found ${filesInDesktop.length}`
          );
        }
      }),
      func('Uptime', laptopMachines, async () => {
        const MAX_UPTIME_DAYS = 10;
        const uptimeStdout = (await execa('uptime')).stdout.trim();
        // if the machine has been up less than a day, it will be one of these formats
        const matchedLessThanOneHour = uptimeStdout.match(/[0-9]+:[0-9]+\s*up [0-9]+ mins,/);
        const matchedLessThanOneDay = uptimeStdout.match(/[0-9]+:[0-9]+\s*up [0-9]+:[0-9]+,/);
        if (matchedLessThanOneHour || matchedLessThanOneDay) {
          return;
        }
        // will match this if it has been more than one day
        const matchedMultipleDays = uptimeStdout.match(/[0-9]+:[0-9]+\s*up ([0-9]*) days?/);
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
      }),
    ]),

    // TODO: check projects for TODOs over a specified threshold
    // don't put everything in here, just projects that should actually be a priority
    // can even specify a subdir of a project, or specific file, if I care about only that
    // group('Project TODOs', ['homeLaptop'], [
    //   {
    //     type: TaskType.PROJECT_TODOS,
    //     machines: 'inherit',
    //     location: '~/src/gh/dotfiles',
    //     threshold: 20,
    //   },
    // ]),

    group('Music Files', laptopMachines, [
      group('Singalong', 'inherit', [
        renameRenameFiles('inherit', 'SyncPhone/Music/Singalong'),
        // TODO: extract this object like I did with the rename function ^^
        func('file name checks', 'inherit', (ctx) =>
          fileNameChecks(
            ctx,
            path.join(process.env['BASE_SYNC_DIR']!, 'SyncPhone/Music/Singalong'),
            'singalong-music-errors'
          )
        ),
        // TODO: check for duplicate files with different extensions
        // TODO: if all checks pass, write the list to music playlist repo (src/gh/playlists)
        // func('Export singalong music playlist', laptopMachines, () => {}),
      ]),
      group('Workout', 'inherit', [
        renameRenameFiles('inherit', 'SyncPhone/Music/Workout Music'),
        // TODO: extract this object like I did with the rename function ^^
        func('file name checks', 'inherit', (ctx) =>
          fileNameChecks(
            ctx,
            path.join(process.env['BASE_SYNC_DIR']!, 'SyncPhone/Music/Workout Music'),
            'workout-music-errors'
          )
        ),
        // TODO: check for duplicate files with different extensions
        // TODO: if all checks pass, write the list to music playlist repo (src/gh/playlists)
        // func('Export workout music playlist', laptopMachines, () => {}),
      ]),
    ]),

    // check for VPN connection, and block following tasks until connected
    func('Block until connected to VPN...', ['workLaptop'], async () => {
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
    }),

    func('Rdev check', workMachines, async () => {
      const rdevLsStdout = (await execa('rdev', ['ls'])).stdout;
      const rdevMachines = rdevLsStdout
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line !== '')
        .filter((line) => {
          // strip out the initial lines that are not actually rdev machines
          return !(/^Name/.test(line) || /------/.test(line));
        });
      const numMachines = rdevMachines.length;
      if (numMachines > 1) {
        throw new Error(
          `'rdev ls' output:\n${rdevLsStdout}\nYou have ${numMachines} rdev machines. Run 'rdev delete <machine>' to get rid of at least one of these: ${rdevMachines.join(
            ', '
          )}`
        );
      }
    }),

    group('Engtools', workMachines, [
      exec('engtools update for laptop', ['workLaptop'], 'brew', ['engtools', 'update']),
      exec('engtools install for laptop', ['workLaptop'], 'send-passwd-for-sudo', [
        process.env['LDAP_PASS']!,
        'brew',
        'engtools',
        'install',
      ]),
      exec('engtools for VM', ['workVM'], 'send-passwd-for-sudo', [
        process.env['LDAP_PASS']!,
        'sudo',
        'yum',
        'install',
        'usr-local-linkedin-dist',
      ]),
    ]),

    group('Update repositories', allMachines, [
      repo_update('dotfiles', allMachines, path.join(os.homedir(), 'src/gh/dotfiles'), [
        'pull&rebase',
        'push',
        'yarn',
      ]),
      repo_update('badash', allMachines, '/usr/local/lib/badash/', ['pull&rebase']),
      repo_update('voyager-web', workMachines, path.join(os.homedir(), 'src/li/voyager-web'), [
        'pull&rebase',
      ]),
      repo_update('work blog', ['workLaptop'], path.join(os.homedir(), 'src/li/blog'), [
        'pull&rebase',
      ]),
      repo_update(
        'node-acid-data-producers',
        ['workLaptop'],
        path.join(os.homedir(), 'src/li/node-acid-data-producers'),
        ['pull&rebase']
      ),
    ]),

    open_url('Open pages - work and home', laptopMachines, {
      'Volta pnpm support RFC': 'https://github.com/volta-cli/rfcs/pull/46',
    }),
    open_url('Open pages - work', ['workLaptop'], {
      blog: 'https://docs.google.com/document/d/1XQskTjmpzn7-SI7B4e0aNYy3gLE5lTfb9IC67rPN53c/edit#',
      tasks:
        'https://docs.google.com/spreadsheets/d/1PFz8_EXZ4W6Kb-r7wpqSSxhKNTE5Dx7evonVXteFqJQ/edit#gid=0',
      reading:
        'https://docs.google.com/document/d/1QXoiUy-DKZb76nkzxx4V_bqO63C6pdFnqCAeGV9WGYs/edit',
      'acid-tmc-jobs':
        'https://testmanager2.tools.corp.linkedin.com/#/product-details/voyager-web?taskName=send-acid-metrics',
    }),

    group('Start Apps', laptopMachines, [
      start_app(
        'work laptop',
        ['workLaptop'],
        [
          '/Applications/Slack.app/Contents/MacOS/Slack',
          '/Applications/Microsoft Outlook.app/Contents/MacOS/Microsoft Outlook',
          '/Applications/Discord.app/Contents/MacOS/Discord',
        ]
      ),
      // TODO: anything for my personal laptop?
    ]),

    group('Add after-task outputs', allMachines, [
      func('Upcoming Dates', 'inherit', async () => {
        const { stdout } = await execa('upcoming-dates.ts');
        FINAL_OUTPUT.push('', stdout, '');
      }),
      func('Current Priorities', 'inherit', async () => {
        const { stdout } = await execa('current-priorities');
        FINAL_OUTPUT.push('', stdout, '');
      }),
      func('Work Reminders', ['workLaptop'], () => {
        FINAL_OUTPUT.push(
          '',
          'Reminders',
          ' - setup your Slack status now!',
          ' - *** Check email for receipts in Outlook! ***'
        );
      }),
    ]),
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
