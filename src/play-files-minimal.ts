// Play the input files and directories in random order
// (using ffprobe and ffplay, from ffmpeg)

import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

// extensions that I currently use
const AUDIO_FILE_EXTENSIONS = ['.flac', '.opus', '.mp3'];

function isAudioFile(file: string) {
  const ext = path.extname(file);
  return AUDIO_FILE_EXTENSIONS.includes(ext);
}

// shuffle the input array in O(n) time
// from https://stackoverflow.com/a/12646864
function shuffleArray<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  // have to return the array, don't know why they don't in the code there
  return array;
}

// collect all audio files from the input files and directories, and randomize them
function getRandomizedInputFiles(): Promise<string[]> {
  return new Promise((resolve, reject) => {
    // argv[0] is node
    // argv[1] is this script
    // argv[2] an onward are the input files and dirs
    const args = process.argv.slice(2);
    if (args.length === 0) {
      reject('Error: You must input at least one file or directory');
    } else {
      // initialize
      const allAudioFiles = [];
      let filesAndDirsToProcess = args;
      let numDirsFound = 0;
      let haveError = false;

      for (let i = 0; i < filesAndDirsToProcess.length; i++) {
        const fileOrDir = filesAndDirsToProcess[i];

        // first check that it exists before trying to stat
        const exists = fs.existsSync(fileOrDir);
        if (!exists) {
          reject(`Error: ${fileOrDir} does not exist`);
          haveError = true;
          break;
        }

        // then stat and figure out if it's a file or directory or what
        const stat = fs.lstatSync(fileOrDir);
        if (stat.isDirectory()) {
          // add all the things in this dir to the list of things to process (then process them)
          const filesInDir = fs.readdirSync(fileOrDir);
          // have to prepend the dir to get the full path
          const thingsToProcess = filesInDir.map((f) => path.join(fileOrDir, f));
          filesAndDirsToProcess = filesAndDirsToProcess.concat(thingsToProcess);
          numDirsFound++;
        } else if (stat.isFile()) {
          // make sure it's an audio file - don't try to play cover art or whatever
          if (isAudioFile(fileOrDir)) {
            allAudioFiles.push(fileOrDir);
          }
        } else {
          reject(`Error: ${fileOrDir} is not a file or directory`);
          haveError = true;
          break;
        }
      }
      if (!haveError) {
        console.log(`Found ${allAudioFiles.length} audio files (in ${numDirsFound} directories)`);
        resolve(shuffleArray(allAudioFiles));
      }
    }
  });
}

// play the input list of audio files
async function playFiles(files: string[]) {
  //console.log(files);
  for (const file of files) {
    //console.log(`playing file ${file}`);
    await displayAndPlay(file);
  }
}

// display the metadata for the file, then play it
function displayAndPlay(filename: string) {
  return (
    getFileTags(filename)
      // display the file info
      .then((jsonData) => parseMetadataTags(jsonData))
      .then((metadataTags) => outputFileInfo(metadataTags))
      // play it
      .then(() => playAudioFile(filename))
  );
}

// get the metadata tags for the input file
function getFileTags(filename: string): Promise<TagJson> {
  return new Promise((resolve, reject) => {
    // use ffprobe to get the metadata tags for the file in JSON format
    let tagsJsonData = '';
    const ffprobe = spawn('ffprobe', [
      '-loglevel',
      'error',
      '-of',
      'json',
      '-show_entries',
      'stream_tags:format_tags',
      filename,
    ]);

    ffprobe.stdout.on('data', (data) => {
      tagsJsonData += data;
    });

    ffprobe.on('close', (code) => {
      if (code !== 0) {
        reject(`ffprobe exited with code ${code}`);
      } else {
        resolve(JSON.parse(tagsJsonData));
      }
    });
  });
}

// combine the metadata tags from stream and format info
// these tags can be stored in the file in one of two sections (that I know of):
// $ ffprobe -loglevel error -of json -show_entries stream_tags:format_tags A\ Ninja\ Slob\ Drew\ Me\ -\ Sampler\ -\ 01\ We\ Are\;.flac
// {
//     "streams": [
//         {
//
//         },
//         {
//             "tags": {
//                 "comment": "Cover (front)"
//             }
//         }
//     ],
//     "format": {
//         "tags": {
//             "TITLE": "We Are;",
//             "ARTIST": "A Ninja Slob Drew Me",
//             "DATE": "2014",
//             "COMMENT": "Visit http://ninjaslob.bandcamp.com",
//             "ALBUM": "Sampler",
//             "track": "1",
//             "album_artist": "A Ninja Slob Drew Me"
//         }
//     }
// }
//
// $ ffprobe -loglevel error -of json -show_entries stream_tags:format_tags A\ Ninja\ Slob\ Drew\ Me\ -\ Sampler\ -\ 01\ We\ Are\;.opus
// {
//     "streams": [
//         {
//             "tags": {
//                 "encoder": "Lavc58.54.100 libopus",
//                 "TITLE": "We Are;",
//                 "ARTIST": "A Ninja Slob Drew Me",
//                 "DATE": "2014",
//                 "comment": "Visit http://ninjaslob.bandcamp.com",
//                 "ALBUM": "Sampler",
//                 "track": "1",
//                 "album_artist": "A Ninja Slob Drew Me"
//             }
//         }
//     ],
//     "format": {
//
//     }
// }

type TagJson = {
  streams?: {
    tags: Record<string, string>;
  }[];
  format?: {
    tags?: Record<string, string>;
  };
};

type MetadataTags = Record<string, string>;

function parseMetadataTags(tagJson: TagJson): Promise<MetadataTags> {
  return new Promise((resolve) => {
    const tags: Record<string, string> = {};
    if (tagJson['streams'] !== undefined && Array.isArray(tagJson['streams'])) {
      tagJson['streams'].forEach((stream) => {
        if (stream['tags'] !== undefined) {
          // store these tags first, converting everything to lowercase
          Object.keys(stream['tags']).forEach(
            (tag) => (tags[tag.toLowerCase()] = stream['tags'][tag])
          );
        }
      });
    }
    //console.log('after stream tags');
    //console.log(tags);

    const tagFormat = tagJson['format'];
    if (tagFormat !== undefined) {
      const tagFormatTags = tagFormat['tags'];
      if (tagFormatTags !== undefined) {
        // store these tags now, converting everything to lowercase
        // (and possibly overwriting the previous tags - these win in precedence)
        Object.keys(tagFormatTags).forEach((tag) => (tags[tag.toLowerCase()] = tagFormatTags[tag]));
      }
    }
    //console.log('after format tags');
    //console.log(tags);

    resolve(tags);
  });
}

// output the file info to the console
function outputFileInfo(tags: MetadataTags) {
  // blank line so this will scroll down to only show the next 2 lines
  console.log('');
  // black music notes with a white background
  const notes = chalk.green.bold('♪');
  // note the en dash here (not a hyphen)
  let artistAndAlbum = `${tags.artist} – ${tags.title}`;
  // limit this length to 80 chars, adding ellipsis for anything longer (some titles are very long…)
  if (artistAndAlbum.length > 80) {
    artistAndAlbum = `${artistAndAlbum.substring(0, 79)}…`;
  }
  const artistAndAlbumColored = chalk.green.bold(artistAndAlbum);
  console.log(`${notes} ${artistAndAlbumColored}`);
  // show a URL to the artist's page below the song that's playing
  // (spaced nicely so it lines up with above)
  console.log(`   ${tags.url ? tags.url : ''}`);
}

// play the file
function playAudioFile(file: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const ffplay = spawn('ffplay', ['-nodisp', '-autoexit', '-volume', '4', file], {
      stdio: 'ignore',
    });

    ffplay.on('close', (code) => {
      if (code !== 0) {
        reject(`ffprobe exited with code ${code}`);
      } else {
        resolve();
      }
    });
  });
}

getRandomizedInputFiles()
  .then((audioFiles) => playFiles(audioFiles))
  .catch((err) => {
    console.error(`Error: ${err}`);
    process.exit(1);
  });
