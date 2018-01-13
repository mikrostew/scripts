/* eslint no-param-reassign: 0, no-console: 0 */

// Get a list of all files with their sizes for the input directory

// Run like:
//  node list-files-and-sizes.js <dir>

// This script:
// * recursively walks the file tree to get a list of files in order
// * stats each file to get the file size
// and writes the results to a JSON file

const fs = require('fs');
const path = require('path');

// return an ordered list of files in the input dir, with full paths
function listFilesSync(dir) {
  let fileList = [];
  const files = fs.readdirSync(dir);
  files.forEach((file) => {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      fileList = fileList.concat(listFilesSync(fullPath));
    } else {
      fileList.push(fullPath);
    }
  });
  return fileList;
}

// remove node and the script name
const dirs = process.argv.slice(2);

dirs.forEach((directory) => {
  const fullDirPath = path.resolve(directory);
  console.log(`Processing dir '${fullDirPath}'...`);

  const fullFileList = listFilesSync(fullDirPath);
  console.log(`Found ${fullFileList.length} files`);

  const filesAndSizes = fullFileList.map((f) => {
    return {
      file: f,
      size: fs.statSync(f).size,
    };
  });

  const outFile = `${directory}-files-stats.json`;
  fs.writeFileSync(outFile, JSON.stringify(filesAndSizes, null, 2));
  console.log(`Wrote file ${outFile}`);
});
