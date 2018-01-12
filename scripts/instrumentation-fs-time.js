/* eslint no-param-reassign: 0, no-console: 0 */

// For use with instrumentation.*.json files from BROCCOLI_VIZ=1 just ember b (or similar commands)

// Run like:
//  node instrumentation-fs-time.js <file1> , <file2>, ...

// This script:
// * parses the instrumentation.*.json files,
// * collects the 'count' and 'time' for 'fs', 'async-disk-cache', and 'sync-disk-cache',
// * orders by time, descending,
// and writes the results to a JSON file

const fs = require('fs');

// collect the time and count stats for 'fs', 'async-disk-cache', or 'sync-disk-cache'
function collectStatsForBlock(statsBlock, allStats, labelForStat) {
  Object.keys(statsBlock).forEach((statName) => {
    const statLabel = labelForStat(statName);
    if (allStats[statLabel] === undefined) {
      // doesn't exist, add it
      allStats[statLabel] = {
        name: statLabel,
        count: statsBlock[statName].count,
        time: statsBlock[statName].time,
      };
    } else {
      allStats[statLabel].count += statsBlock[statName].count;
      allStats[statLabel].time += statsBlock[statName].time;
    }
  });
}

// remove node and the script name
const files = process.argv.slice(2);

files.forEach((filename) => {
  console.log(`Processing file '${filename}'...`);

  const allStats = {};
  const data = JSON.parse(fs.readFileSync(filename, 'utf8'));

  data.nodes.forEach((node) => {
    if (node.stats) {
      if (node.stats.fs) {
        collectStatsForBlock(node.stats.fs, allStats, (name) => `fs - ${name}`);
      }
      if (node.stats['async-disk-cache']) {
        collectStatsForBlock(node.stats['async-disk-cache'], allStats, (name) => `async-disk-cache - ${name}`);
      }
      if (node.stats['sync-disk-cache']) {
        collectStatsForBlock(node.stats['sync-disk-cache'], allStats, (name) => `sync-disk-cache - ${name}`);
      }
    } else {
      console.log(`node ${node.label.name} has no stats`);
    }
  });

  // convert to array and sort descending order by time
  const sortedStats = Object.keys(allStats).map((k) => allStats[k]).sort((a, b) => b.time - a.time);

  // convert nanoseconds to seconds for readability
  sortedStats.forEach((stat) => {
    stat.time /= 1000 * 1000 * 1000;
  });

  fs.writeFileSync(`${filename}-fs-stats.json`, JSON.stringify(sortedStats, null, 2));
});
