/* eslint no-param-reassign: 0, no-console: 0 */

// For use with instrumentation.*.json files from BROCCOLI_VIZ=1 ember b (or similar commands)

// Run like:
//  node instrumentation-self-time.js <file1> , <file2>, ...

// This script:
// * parses the instrumentation.*.json files,
// TODO: als does other things...

const fs = require('fs');

const files = process.argv.slice(2);

files.forEach((filename) => {
  console.log(`Processing file '${filename}'...`);

  const json = JSON.parse(fs.readFileSync(filename, 'utf8'));
  let stats = {};
  let totalTime = 0;

  json.nodes.forEach((node) => {
    const funcName = node.label.name;
    if (stats[funcName] === undefined) {
      // doesn't exist, add it
      stats[funcName] = {
        id: funcName,
        selftime: node.stats.time.self,
        calls: 1,
      };
    } else {
      // already exists, update
      stats[funcName].selftime += node.stats.time.self;
      stats[funcName].calls += 1;
    }

    // keep track of total time
    totalTime += node.stats.time.self;
  });

  console.log(`Total time: ${totalTime / (1000 * 1000 * 1000)}`);

  let statsArray = Object.keys(stats).map((k) => stats[k]);

  // sort descending order by self time
  let sortedStats = statsArray.sort((a, b) => b.selftime - a.selftime);

  // convert nanoseconds to seconds for readability
  // and calculate percentage of total time
  sortedStats.forEach((stat) => {
    stat.percent = 100 * (stat.selftime / totalTime);
    stat.selftime /= 1000 * 1000 * 1000;
  });

  // write that out to a file
  let selfTimeFile = `${filename}-selftime.json`;
  console.log(`Writing file '${selfTimeFile}'`);
  fs.writeFileSync(selfTimeFile, JSON.stringify(sortedStats, null, 2));

  // next, combine things so I can get a sense of Babel vs Eyeglass vs other

  // TODO: clean this up to avoid all the repetition
  let combinedStats = {
    eyeglass: {
      id: "eyeglass",
      time: 0,
      calls: 0,
      percent: 0,
    },
    babel: {
      id: "babel",
      time: 0,
      calls: 0,
      percent: 0,
    },
    cleanup: {
      id: "cleanup",
      time: 0,
      calls: 0,
      percent: 0,
    },
    command: {
      id: "command",
      time: 0,
      calls: 0,
      percent: 0,
    },
    patch: {
      id: "patch",
      time: 0,
      calls: 0,
      percent: 0,
    },
    other: {
      id: "other",
      time: 0,
      calls: 0,
      percent: 0,
    }
  };

  let eyeglassRegex = /eyeglass/i;
  let babelRegex = /babel/i;
  let cleanupRegex = /cleanup/i;
  let commandRegex = /command/i;
  let patchRegex = /patch/i;

  // TODO: clean this up somehow to avoid all the repetition?
  sortedStats.forEach((stat) => {
    if (stat.id.match(babelRegex)) {
      combinedStats.babel.time += stat.selftime;
      combinedStats.babel.calls += stat.calls;
      combinedStats.babel.percent += stat.percent;
    } else if (stat.id.match(eyeglassRegex)) {
      combinedStats.eyeglass.time += stat.selftime;
      combinedStats.eyeglass.calls += stat.calls;
      combinedStats.eyeglass.percent += stat.percent;
    } else if (stat.id.match(cleanupRegex)) {
      combinedStats.cleanup.time += stat.selftime;
      combinedStats.cleanup.calls += stat.calls;
      combinedStats.cleanup.percent += stat.percent;
    } else if (stat.id.match(commandRegex)) {
      combinedStats.command.time += stat.selftime;
      combinedStats.command.calls += stat.calls;
      combinedStats.command.percent += stat.percent;
    } else if (stat.id.match(patchRegex)) {
      combinedStats.patch.time += stat.selftime;
      combinedStats.patch.calls += stat.calls;
      combinedStats.patch.percent += stat.percent;
    } else {
      combinedStats.other.time += stat.selftime;
      combinedStats.other.calls += stat.calls;
      combinedStats.other.percent += stat.percent;
    }
  });

  let combinedArray = Object.keys(combinedStats).map((k) => combinedStats[k]);

  // sort descending order by self time
  let sortedCombinedStats = combinedArray.sort((a, b) => b.time - a.time);

  // write that out to a file
  let combinedTimeFile = `${filename}-combined.json`;
  console.log(`Writing file '${combinedTimeFile}'`);
  fs.writeFileSync(combinedTimeFile, JSON.stringify(sortedCombinedStats, null, 2));
});

