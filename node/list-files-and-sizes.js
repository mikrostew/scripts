/* eslint no-param-reassign: 0, no-console: 0 */

// Get a list of all files with their sizes for the input directory
// NOTE: this is a simple implementation - for dir with millions of files this will run out of heap

// Run like:
//  node list-files-and-sizes.js <dir>

// This script:
// * recursively walks the file tree to get a list of files in order,
// * stats each file to get the file size,
// and writes the results to a JSON file

const fs = require('fs');
const path = require('path');

// return an ordered list of files in the input dir, with full paths
function listFilesSync(dir) {
  let fileList = [];
  fs.readdirSync(dir).forEach((file) => {
    const fullPath = path.join(dir, file);
    // use lstat so this does not follow dir symlinks
    // (otherwise this will include files from other dirs, which I don't want)
    if (fs.lstatSync(fullPath).isDirectory()) {
      fileList = fileList.concat(listFilesSync(fullPath));
    } else {
      fileList.push(fullPath);
    }
  });
  return fileList;
}

// return an object with the file path and file size
function fileAndSize(file) {
  return {
    file,
    size: fs.statSync(file).size,
  };
}

// remove node and the script name
const dirs = process.argv.slice(2);

dirs.forEach((directory) => {
  const fullDirPath = path.resolve(directory);
  console.log(`Processing dir '${fullDirPath}'...`);

  const fullFileList = listFilesSync(fullDirPath);
  console.log(`Found ${fullFileList.length} files`);

  const filesAndSizes = fullFileList.map(fileAndSize);

  const outFile = `${path.basename(directory)}-files-stats.json`;
  fs.writeFileSync(outFile, JSON.stringify(filesAndSizes, null, 2));
  console.log(`Wrote file ${outFile}`);
});
