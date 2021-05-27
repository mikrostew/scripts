#!/usr/bin/env ts-node

// TODO: start transitioning tasks here

import execa from 'execa';
import Listr, { ListrContext } from 'listr';
import which from 'which';

enum TaskType {
  HOMEBREW = 'homebrew',
}

interface ConfigTask {
  title: string;
  type: TaskType;
  packages: HomebrewPackage[];
}

interface HomebrewPackage {
  // name of the package
  name: string;
  // name of an executable installed by the package
  executable: string;
}

// TODO: read config file for this
const config: ConfigTask[] = [
  {
    title: 'Homebrew',
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
];

// return if the input executable is installed or not
async function isInstalled(executable: string): Promise<boolean> {
  return which(executable)
    .then(() => true)
    .catch(() => false);
}

// convert homebrew packages to list of tasks for install/upgrade
function homebrewPackageToTask(pkg: HomebrewPackage) {
  return [
    {
      title: `check if ${pkg.name} is installed (${pkg.executable})`,
      task: async (ctx: ListrContext) => {
        ctx[pkg.name] = await isInstalled(pkg.executable);
      },
    },
    {
      title: `install ${pkg.name}`,
      enabled: (ctx: ListrContext) => ctx[pkg.name] === false,
      task: () => execa('brew', ['install', pkg.name]),
    },
    {
      title: `upgrade ${pkg.name}`,
      enabled: (ctx: ListrContext) => ctx[pkg.name] === true,
      task: () => execa('brew', ['upgrade', pkg.name]),
    },
  ];
}

// TODO: convert tasks to things
function doTaskThings(task: ConfigTask) {
  // TODO: use task.type to figure out how to populate this
  return {
    title: task.title,
    task: () => {
      // convert all the configured homebrew packages to tasks
      return new Listr(task.packages.map((pkg) => homebrewPackageToTask(pkg)).flat(), {
        exitOnError: false,
      });
    },
  };
}

const tasks: Listr = new Listr(config.map((task) => doTaskThings(task)));

tasks.run().catch((err) => {
  // TODO: when does this error?
  console.error(err);
});
