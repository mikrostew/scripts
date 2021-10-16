#!/usr/bin/env ts-node

// TODO: I'd like to do this, but I'm on node 12.x - probably should upgrade
//import { readdir } from 'fs/promises';
//import { promises as fsPromises } from 'fs';
//import os from 'os';
//import path from 'path';

//import execa from 'execa';
import {
  TaskType,
  Config,
  // renameRenameFiles,
  // fileNameChecks,
  // syncConflictCheck,
  // sleep,
  runTasks,
} from '@mikrostew/good-morning';

// add things to this, to display after the tasks are run
//const FINAL_OUTPUT: string[] = [];

const config: Config = {
  // environment: {
  //   BASE_SYNC_DIR: /(MacBook-Air|Michaels-Air)/i.test(os.hostname())
  //     ? process.env['HOME']!
  //     : '/usr/local/SyncThing',
  // },
  machines: {
    homeLaptop: /(MacBook-Air|Michaels-Air)/i,
    workLaptop: /mistewar-mn/,
    workVM: /mistewar-ld/,
  },
  tasks: [
    {
      name: 'Work laptop processes',
      type: TaskType.KILL_PROC,
      machines: ['workLaptop'],
      processes: [
        'Activity Monitor',
        'zoom.us',
        'App Store',
        'Discord',
        'Microsoft Word',
        'obs',
        'Slack',
        'Outlook',
        'Microsoft Error Reporting',
        'Microsoft Teams',
        'Camo Studio',
      ],
    },
  ],
};

// TODO: set my Slack status, and set myself as away
// TODO: if it's Friday, also shut down the browsers (with prompts), and check for software updates?

//const args = process.argv.slice(2);

runTasks(config).then(() => {
  // things after the tasks
  //console.log(FINAL_OUTPUT.join('\n'));
});
