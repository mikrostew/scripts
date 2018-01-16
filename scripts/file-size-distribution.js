/* eslint no-param-reassign: 0, no-console: 0 */

// Get some simple stats on file size distribution, from the JSON file output by list-files-and-sizes

// Run like:
//  node file-size-stats.js <file.json>

// This script:
// * reads the file size stats and sorts them into bins by size
// and writes the results to a JSON file

const fs = require('fs');

// bins of 1kB, 4KB, 16KB, ... , 64MB
const BINS = [];
for (let i = 0; i < 9; i++) {
  BINS.push(Math.pow(4, i) * 1024);
}

// remove node and the script name
const statsFiles = process.argv.slice(2);

statsFiles.forEach((statFile) => {
  const fileCounts = {};
  BINS.forEach((binSize) => { fileCounts[binSize] = 0; });
  fileCounts.bigger = 0; // for files bigger than the biggest bin size

  console.log(`Processing file '${statFile}'...`);
  const data = JSON.parse(fs.readFileSync(statFile, 'utf8'));

  const numFiles = data.length;

  data.forEach((fileInfo) => {
    // TODO do some maths here to find the bin, instead of inner loop ¯\_(ツ)_/¯
    fileCounts.bigger += 1;
    for (let i = 0; i < BINS.length; i++) {
      const binSize = BINS[i];
      if (fileInfo.size <= binSize) {
        fileCounts[binSize] += 1;
        fileCounts.bigger -= 1;
        break;
      }
    }
  });

  const percentages = {};
  Object.keys(fileCounts).forEach((size) => {
    percentages[size] = 100 * (fileCounts[size] / numFiles);
  });

  const distribution = {
    fileCounts,
    percentages,
  };
  console.log('Distribution:');
  console.log(distribution);

  const outFile = `${statFile}-size-distribution.json`;
  fs.writeFileSync(outFile, JSON.stringify(distribution, null, 2));
  console.log(`Wrote file ${outFile}`);
});
