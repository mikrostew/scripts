// download images and video from Moment Garden

// function printUsage() {
//   console.log('Usage:');
//   console.log('  moment-garden-download [options]');
//   console.log('');
//   // TODO
//   // Options
//   //  --full   --> go thru the whole garden, download everything to check if I missed something
//   //  --local, or --no-cache    --> don't query the MG site, just download anything that doesn't exist locally
//   //  --limit     --> limit the number of files downloaded (default is all)
//   //  --verbose    --> log everything
//   //  --help    --> show this message
// }

import chalk from 'chalk';
import fs from 'fs';
import fsPromises from 'fs/promises';
import https from 'https';
import ora from 'ora';
import os from 'os';
import path from 'path';

// different paths for different machines
let SYNC_DIR;
const HOST_NAME = os.hostname();
if (/MacBook-Air/.test(HOST_NAME) || /Michaels-Air/.test(HOST_NAME)) {
  // home laptop
  SYNC_DIR = path.join('/', 'Users', 'mikrostew', 'SyncImages', 'MomentGarden');
} else if (/mistewar-mn/.test(HOST_NAME)) {
  // work laptop
  SYNC_DIR = path.join('/', 'usr', 'local', 'SyncThing', 'SyncImages', 'MomentGarden');
} else {
  console.error(`Unknown host '${HOST_NAME}'`);
  process.exit(1);
}

// seems to work if I just use the same timestamp for all requests
const TIMESTAMP = new Date().getTime();

// this is the default for the web interface
const PER_PAGE = 50;

// types of moments
const TYPE_TEXT = 1;
const TYPE_IMAGE = 2;
// TODO: what is type 3?
const TYPE_VIDEO = 4;
const TYPE_EVENT = 5;

// config for this stuff
// (so I don't commit secrets to the repo)
// format is:
// [
//   {
//     name: 'Name',
//     cookies: [ 'CAKEPHP=1234...', 'CakeCookie[Auth][User]=ABCD...',
//     gardenId: '12345',
//   },
//   ...
// ]

type MgConfig = {
  name: string;
  cookies: string[];
  gardenId: string;
}[];

const mgConfig: MgConfig = require(path.join(SYNC_DIR, '.mg-config.js'));

type MomentItemMeta = {
  montage?: string;
  video_path?: string;
  video_path_hd?: string;
  // rotation: number;
  // vid_hd: string;
  // vid_original: string;
  // vid_mp4: string;
  // s3: number;
  // thumbnail_hd: string;
};

// things I don't use are commented out
type MomentItem = {
  id: string;
  // parent_id: string;
  // contributor_id: '332785';
  type: string;
  // title: 'No subject';
  // data: string;
  // kid_id: string;
  // thumb: string;
  path: string;
  // pending: boolean
  meta: MomentItemMeta | null;
  // aspect_ratio: number | null;
  // m_size: string;
  // comment_cnt: number;
  // love_cnt: number;
  // private: string;
  // fb_post_id: string | null;
  // timestamp: string | null;
  unix_timestamp: string;
  // created: string;
};

// TODO: configurable limit to number of downloaded files
const DOWNLOAD_FILE_LIMIT = 20;

function dateFromTimestamp(unixTimestamp: string) {
  // ISO date format is YYYY-MM-DDTHH:mm:ss.sssZ - just return the date part
  return new Date(Number(unixTimestamp) * 1000).toISOString().split('T')[0];
}

// make the request to moment garden
async function requestMoments(
  gardenID: string,
  pageNumber: number,
  perPage: number,
  timestamp: number,
  cookies: string[]
): Promise<MomentItem[]> {
  const options = {
    method: 'GET',
    hostname: 'momentgarden.com',
    port: 443, // default
    path: `/moments/more/${gardenID}/${pageNumber}/${perPage}/desc?_=${timestamp}`,
    headers: {
      Accept: '*/*',
      'Accept-Language': 'en-US,en;q=0.5',
      Referer: 'https://momentgarden.com/moments/gardens',
      'X-Requested-With': 'XMLHttpRequest',
      // TODO: how can I update this periodically?
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:87.0) Gecko/20100101 Firefox/87.0',
      Cookie: cookies.join('; '),
    },
  };

  let data = '';

  return new Promise((resolve) => {
    const req = https.request(options, (res) => {
      if (res.statusCode != 200) {
        console.log('statusCode:', res.statusCode);
      }
      // console.log('headers:', res.headers);
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        // console.log(`BODY: ${chunk}`);
        data += chunk;
      });
      res.on('end', () => {
        // console.log('No more data in response.');
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (err) {
          console.error('DATA:');
          console.error(data);
          throw err;
        }
      });
    });

    req.on('error', (e) => {
      //console.error(e);
      throw e;
    });
    req.end();
  });
}

// write each item in the input array to disk
// return count of new (previously un-cached) items
async function cacheMetadata(items: MomentItem[], cacheDir: string) {
  let newlyCachedItems = 0;

  for (const item of items) {
    const id = item.id;
    const itemCacheFile = path.join(cacheDir, `${id}.json`);

    // ensure that directory exists
    await fsPromises.mkdir(cacheDir, { recursive: true });

    // check if cache file already exists
    try {
      // this will throw/reject if files doesn't exist
      await fsPromises.access(itemCacheFile);
      // console.log(`File ${itemCacheFile} exists, skipping`);
    } catch (error: unknown) {
      await fsPromises.writeFile(itemCacheFile, JSON.stringify(item));
      // console.log(`Wrote new file ${itemCacheFile}`);
      newlyCachedItems++;
    }
  }
  return newlyCachedItems;
}

// download any new metadata for recent moments
async function downloadMomentMetadata(gardenId: string, cookies: string[], metadataDir: string) {
  let currentPage = 1;
  let newItemsFound = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const requestSpinner = ora(`${chalk.yellow('request')}: moment metadata`).start();
    const someMoments = await requestMoments(gardenId, currentPage, PER_PAGE, TIMESTAMP, cookies);
    requestSpinner.stop();

    //console.log(`(page ${currentPage}) Downloaded info for ${someMoments.length} moments`);

    if (someMoments.length === 0) {
      //console.log('No more moments to download');
      break;
    }

    // go thru each object in that array, and write it to disk,
    // like 12347890.json, in a single directory (should be fine for the number of files there are)
    const newItems = await cacheMetadata(someMoments, metadataDir);
    //console.log(`found ${newItems} new item(s)`);
    newItemsFound += newItems;

    // if no new items after checking at least 2 pages, exit
    // TODO: unless --full
    if (newItems === 0 && currentPage >= 2) {
      //console.log('No more new items found');
      break;
    }

    // wait for 5 seconds between API requests, to be nice to the server
    await countdownSpinner(5, `${chalk.yellow('wait')}: between API requests`);
    currentPage++;
  }

  console.log(`Found ${newItemsFound} new item(s)`);
}

// verify that all media (images, videos, etc.) have been downloaded for all cached metadata
async function downloadMedia(metadataDir: string, mediaDir: string) {
  const allFiles = await fsPromises.readdir(metadataDir);

  // output directories
  const imageDir = path.join(mediaDir, 'image');
  const videoDir = path.join(mediaDir, 'video');

  // ensure the output directories exist
  await fsPromises.mkdir(imageDir, { recursive: true });
  await fsPromises.mkdir(videoDir, { recursive: true });

  let numFilesDownloaded = 0;
  let numErrors = 0;

  try {
    console.log(`Checking ${allFiles.length} metadata items for download`);
    for (const file of allFiles) {
      if (file === '.DS_Store') {
        // this will fail, I hate these files, delete it and keep going
        console.log(`Removing dumb file ${path.join(metadataDir, file)}`);
        await fsPromises.unlink(path.join(metadataDir, file));
        continue;
      }
      let didDownload = false;
      let errString;

      const contents = await fsPromises.readFile(path.join(metadataDir, file), 'utf8');
      let item: MomentItem;
      try {
        item = JSON.parse(contents);
      } catch (err) {
        console.error(`Error: Failed to parse file '${path.join(metadataDir, file)}' as JSON`);
        throw err;
      }
      const type = Number(item.type);
      // console.log(type);
      if (type === TYPE_TEXT) {
        // don't need to download - already have the text info in the JSON file
        //console.log(`${chalk.yellow('(skip)')} Text type - nothing to do here`);
      } else if (type === TYPE_IMAGE) {
        //console.log('TODO: image to download...');
        [didDownload, errString] = await maybeDownloadImage(item, imageDir);
        //break;
      } else if (type === TYPE_VIDEO) {
        //console.log('TODO: video to download...');
        [didDownload, errString] = await maybeDownloadVideo(item, videoDir);
        //break;
      } else if (type === TYPE_EVENT) {
        // don't need to download - already have the text info in the JSON file
        //console.log(`${chalk.yellow('(skip)')} Event type - nothing to do here`);
      } else {
        // unknown type
        console.error(`Unknown item type ${type}`);
        throw new Error(`Unknown item type ${type}`);
      }

      if (errString !== undefined) {
        numErrors++;
        // so that this will exit non-zero
        process.exitCode = 1;
        // wait between files
        await countdownSpinner(
          5,
          `${chalk.yellow('wait')}: downloaded ${numFilesDownloaded}, waiting between files`
        );
      }

      if (didDownload) {
        numFilesDownloaded++;
        if (numFilesDownloaded >= DOWNLOAD_FILE_LIMIT) {
          console.log(`(hit download file limit of ${DOWNLOAD_FILE_LIMIT})`);
          break;
        }

        // wait between files, so I'm not overloading the wifi here
        await countdownSpinner(
          5,
          `${chalk.yellow('wait')}: downloaded ${numFilesDownloaded}, waiting between files`
        );
      }
    }
  } catch (err) {
    console.error('Error: failure when downloading:');
    console.error(err);
    // so that this will exit non-zero
    process.exitCode = 1;
  }

  console.log(`Downloaded ${numFilesDownloaded} files`);
  console.log(`With ${numErrors} errors`);
  console.log('');
}

// countdown spinner for the input number of seconds, showing the input message
async function countdownSpinner(seconds: number, message: string) {
  let secondsRemaining = seconds;
  const waitSpinner = ora(`${message} (${secondsRemaining} seconds)`).start();

  await new Promise((resolve) => {
    // update the spinner message every second
    const intervalId = setInterval(() => {
      secondsRemaining--;
      if (secondsRemaining <= 0) {
        // all done
        clearInterval(intervalId);
        resolve(undefined);
      } else {
        waitSpinner.text = `${message} (${secondsRemaining} seconds)`;
      }
    }, 1000);
  });
  waitSpinner.stop();
}

// TODO: keep stats on this stuff - return something like 'downloaded | skipped | somethingelse'
// returns whether something was downloaded or not
async function maybeDownloadImage(
  item: MomentItem,
  imageDir: string
): Promise<[boolean, string | undefined]> {
  if (item.meta && item.meta.montage) {
    let didADownload = false;
    let errString = '';
    // montage, which has multiple possible images to download
    const id = item.id;
    // like the other images, get the full resolution
    const mainPath = item.path.replace('moments-large', 'moments-full');
    let urls = [mainPath];
    const date = dateFromTimestamp(item.unix_timestamp);
    const urlPath = path.dirname(mainPath);
    urls = urls.concat(item.meta.montage.split(',').map((img) => `${urlPath}/${img}`));
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      const filePath = outputFilePath(date, url, imageDir);
      if (!(await isDownloaded(filePath))) {
        try {
          //console.log(`Downloading ${url}...`);
          await downloadItem(url, filePath, { id, date });
          didADownload = true;
        } catch (err) {
          if (err instanceof Error) {
            console.error(err.message);
            errString += err.message;
          } else {
            throw err;
          }
        }
      } else {
        //console.log(`${chalk.yellow('(skip)')} ${url}`);
      }
    }
    if (errString !== '') {
      return [didADownload, errString];
    }
    return [didADownload, undefined];
  } else {
    // just a single URL to download
    const id = item.id;
    // this will be something like https://s3.amazonaws.com/moments-large/9212055_4w2w6r5gqqeb42w47ulwfcjs6.JPG
    // change to https://s3.amazonaws.com/moments-full/9212055_4w2w6r5gqqeb42w47ulwfcjs6.JPG
    // which is full resolution
    const url = item.path.replace('moments-large', 'moments-full');
    const date = dateFromTimestamp(item.unix_timestamp);
    const filePath = outputFilePath(date, url, imageDir);
    if (!(await isDownloaded(filePath))) {
      try {
        //console.log(`Downloading ${url}...`);
        await downloadItem(url, filePath, { id, date });
        return [true, undefined];
      } catch (err) {
        if (err instanceof Error) {
          console.error(err.message);
          return [false, err.message];
        }
        throw err;
      }
    } else {
      //console.log(`${chalk.yellow('(skip)')} ${url}`);
      return [false, undefined];
    }
  }
}

// TODO: keep stats on this stuff - return something like 'downloaded | skipped | somethingelse'
// returns 2-item tuple:
//  [whether something was downloaded or not, error string if there was an error]
async function maybeDownloadVideo(
  item: MomentItem,
  videoDir: string
): Promise<[boolean, string | undefined]> {
  const id = item.id;
  const date = dateFromTimestamp(item.unix_timestamp);
  // figure out the URL
  let url;
  if (item.meta && item.meta.video_path_hd) {
    url = item.meta.video_path_hd;
  } else if (item.meta && item.meta.video_path) {
    url = item.meta.video_path;
  } else {
    // where is the video URL?
    const errString = `[${id}] item does not have ".meta.video_path_hd" or ".meta.video_path"`;
    console.error(errString);
    console.error(item);
    return [false, errString];
  }

  const filePath = outputFilePath(date, url, videoDir);
  if (!(await isDownloaded(filePath))) {
    //console.log(`Downloading ${url}...`);
    await downloadItem(url, filePath, { id, date });
    return [true, undefined];
  } else {
    //console.log(`${chalk.yellow('(skip)')} ${url}`);
    return [false, undefined];
  }
}

function outputFilePath(date: string, url: string, dir: string) {
  // strip off the first part of the URL, leaving just the file name
  const basename = path.basename(url);
  return path.join(dir, `${date}_${basename}`);
}

// check if file exists, and it has size > 0
async function isDownloaded(filePath: string) {
  try {
    await fsPromises.access(filePath);
    // if that works, the file exists, yay
    const fileStats = await fsPromises.stat(filePath);
    if (fileStats.size > 0) {
      return true;
    }
  } catch (err) {
    // that throws if the file doesn't exist
    return false;
  }
  // file is size 0
  return false;
}

async function downloadItem(url: string, filePath: string, itemInfo: { id: string; date: string }) {
  // adapted from https://stackoverflow.com/a/62056725
  const fileStream = fs.createWriteStream(filePath);
  const downloadSpinner = ora(`${chalk.yellow('download')}: ${itemInfo.date} - ${url}`).start();

  return new Promise((resolve, reject) => {
    const request = https.get(url, (response) => {
      if (response.statusCode !== 200) {
        downloadSpinner.fail();
        //throw new Error(`Failed to GET '${url}' (status: ${response.statusCode})`);
        reject(new Error(`Failed to GET '${url}' (status: ${response.statusCode})`));
        return;
      }
      // pipe the download stream to the file
      response.pipe(fileStream);
    });

    // don't resolve on the end of the response
    // wait to resolve until this finishes, which is after the response completes
    fileStream.on('finish', () => {
      // don't need to show success for every file
      downloadSpinner.stop();
      // TODO: send anything back here?
      resolve('ok');
    });

    request.on('error', (err) => {
      downloadSpinner.fail();
      fs.unlink(filePath, () => {
        throw err;
      });
    });

    fileStream.on('error', (err) => {
      downloadSpinner.fail();
      fs.unlink(filePath, () => {
        throw err;
      });
    });

    // do the reqest
    request.end();
  });
}

(async function () {
  for (const garden of mgConfig) {
    console.log(`Garden: ${garden.name}`);

    const metadataDir = path.join(SYNC_DIR, garden.name, 'metadata');
    const mediaDir = path.join(SYNC_DIR, garden.name);

    //console.log(`Downloading metadata to dir '${metadataDir}'...`);
    await downloadMomentMetadata(garden.gardenId, garden.cookies, metadataDir);

    //console.log(`Downloading media to dir '${mediaDir}'...`);
    await downloadMedia(metadataDir, mediaDir);
  }

  //console.log('DONE!');
})();
