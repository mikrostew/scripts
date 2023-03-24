// show upcoming dates, from the input config file

import path from 'path';
import os from 'os';

type Priority = {
  category: string;
  description: string;
};

type PriorityConfig = {
  priorities: Priority[];
  low_priority: Priority[];
  maintenance: Priority[];
  old_stuff: Priority[];
};

// different paths for different machines
function getConfig(): PriorityConfig {
  const hostName = os.hostname();

  let syncDir;
  if (/MacBook-Air/.test(hostName) || /Michaels-Air/.test(hostName)) {
    // home laptop
    syncDir = path.join('/', 'Users', 'mikrostew', 'Sync');
  } else if (/mistewar-mn/.test(hostName)) {
    // work laptop
    syncDir = path.join('/', 'Users', 'mistewar', 'Sync');
  } else {
    console.error(`Unknown host '${hostName}'`);
    process.exit(1);
  }

  const priorityConfig: PriorityConfig = require(path.join(syncDir, 'priorities.js'));
  return priorityConfig;
}

// printout

const priorityConfig = getConfig();

console.log('Priorities');
priorityConfig.priorities.forEach((priority) => {
  const category = priority.category;
  const description = priority.description;
  console.log(`  - (${category}) ${description}`);
});

console.log('');
console.log('Maintenance');
priorityConfig.maintenance.forEach((priority) => {
  const category = priority.category;
  const description = priority.description;
  console.log(`  - (${category}) ${description}`);
});
