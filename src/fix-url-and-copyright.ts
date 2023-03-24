// Play the input files and directories in random order
// (using ffprobe and ffplay, from ffmpeg)

import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { spawn } from 'child_process';
import tmp from 'tmp';

// extensions that I currently use
const AUDIO_FILE_EXTENSIONS = ['.flac', '.opus', '.mp3'];

// creative commons copyrights that I can use
const COPYRIGHTS = {
  'CC BY 4.0': 'Attribution: http://creativecommons.org/licenses/by/4.0/',
  'CC BY 3.0': 'Attribution: http://creativecommons.org/licenses/by/3.0/',
  'CC BY-NC 4.0': 'Attribution-NonCommercial: http://creativecommons.org/licenses/by-nc/4.0/',
  'CC BY-NC 3.0': 'Attribution-NonCommercial: http://creativecommons.org/licenses/by-nc/3.0/',
} as const;
// the names of those ^^, in an array for later
const COPYRIGHTS_ARR: (keyof typeof COPYRIGHTS)[] = [
  'CC BY 4.0',
  'CC BY 3.0',
  'CC BY-NC 4.0',
  'CC BY-NC 3.0',
];

// use this to cache url and copyright info for each artist
// format is:
// {
//   skip: true | false,          // should files from this artist be skipped?
//   url: "http://...",             // url for this artist
//   copyright: "Attribution...",   // copyright for this artist
// }
const METADATA_PER_ARTIST: Record<string, { skip: boolean; url: string; copyright: string }> = {};

// need to get input from the user for this
const READLINE_INTERFACE = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function isAudioFile(file: string) {
  const ext = path.extname(file);
  return AUDIO_FILE_EXTENSIONS.includes(ext);
}

// collect all audio files from the input files and directories
function getInputFiles(): Promise<string[]> {
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
        resolve(allAudioFiles);
      }
    }
  });
}

// play the input list of audio files
async function modifyFiles(files: string[]) {
  //console.log(files);
  for (const file of files) {
    //console.log(`playing file ${file}`);
    await parseMetadataAndModify(file);
  }
}

// parse the metadata for the file, then modify it if needed
function parseMetadataAndModify(filename: string) {
  // modify the file based on the artist
  return getFileTags(filename)
    .then((jsonData) => parseMetadataTags(jsonData))
    .then((metadataTags) => modifyFileInfo(filename, metadataTags));
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
        //console.log
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

    const tagFormat = tagJson['format'];
    if (tagFormat !== undefined) {
      const tagFormatTags = tagFormat['tags'];
      if (tagFormatTags !== undefined) {
        // store these tags now, converting everything to lowercase
        // (and possibly overwriting the previous tags - these win in precedence)
        Object.keys(tagFormatTags).forEach((tag) => (tags[tag.toLowerCase()] = tagFormatTags[tag]));
      }
    }

    resolve(tags);
  });
}

function promptForCopyright(artist: string): Promise<string> {
  return new Promise((resolve, reject) => {
    console.log(`What copyright does ${artist} use?`);
    for (let i = 0; i < COPYRIGHTS_ARR.length; i++) {
      console.log(`[${i}] ${COPYRIGHTS_ARR[i]}`);
    }
    READLINE_INTERFACE.question('> ', function (inputIndex) {
      if (inputIndex === '') {
        reject('No copyright input given');
      } else {
        // make sure it's a number
        const maybeIndex = Number(inputIndex);
        if (isNaN(maybeIndex)) {
          reject('Valid index not given');
        } else {
          // if the index was valid, return that copyright text
          if (COPYRIGHTS_ARR[maybeIndex] !== undefined) {
            const copyrightType = COPYRIGHTS_ARR[maybeIndex];
            console.log(`(input '${copyrightType}')`);
            resolve(COPYRIGHTS[copyrightType]);
          } else {
            reject('Did not select a valid copyright');
          }
        }
      }
    });
  });
}

function promptForURL(artist: string): Promise<string> {
  return new Promise((resolve, reject) => {
    console.log(`What URL to use for ${artist}?`);
    READLINE_INTERFACE.question('> ', function (inputUrl) {
      if (inputUrl === '') {
        reject('No URL input given');
      } else {
        resolve(inputUrl);
      }
    });
  });
}

// prompt for URL and copyright for this artist, if necessary
// resolves with:
// {
//   url: "http://...",
//   copyright: "blah blah",
// }
async function getArtistInfo(artist: string) {
  if (METADATA_PER_ARTIST[artist] === undefined) {
    const copyright = await promptForCopyright(artist);
    const url = await promptForURL(artist);
    METADATA_PER_ARTIST[artist] = {
      skip: false,
      copyright,
      url,
    };
  }

  // now we have the info
  const metadata = METADATA_PER_ARTIST[artist];
  return {
    url: metadata.url,
    copyright: metadata.copyright,
  };
}

// write the metadata to a new temp file
function writeMetadata(file: string, url: string, copyright: string): Promise<string> {
  // create a new temp file
  const fileExt = path.extname(file);
  const tempFile = tmp.fileSync({ postfix: fileExt });

  return new Promise((resolve, reject) => {
    // use ffprobe to get the metadata tags for the file in JSON format
    let ffmpegStdout = '';
    let ffmpegStderr = '';
    // write the updated file to the temp file
    // NOTES:
    // * '-y' here is for overwriting the temp file that already exists
    // * the stream specifier ":s:a:0" is for the first audio stream, since this doesn't work otherwise
    // TODO: is there a way I can detect that ^^ and pick the right stream automatically?
    const ffmpeg = spawn('ffmpeg', [
      '-y',
      '-i',
      file,
      '-metadata:s:a:0',
      `copyright=${copyright}`,
      '-metadata:s:a:0',
      `url=${url}`,
      '-codec',
      'copy',
      tempFile.name,
    ]);

    ffmpeg.stdout.on('data', (data) => {
      ffmpegStdout += data;
    });

    ffmpeg.stderr.on('data', (data) => {
      ffmpegStderr += data;
    });

    ffmpeg.on('exit', (code) => {
      if (code !== 0) {
        console.error(`ffmpeg exited with code ${code}`);
        console.error(`stdout: ${ffmpegStdout}`);
        console.error(`stderr: ${ffmpegStderr}`);
        reject(`ffmpeg exited with code ${code}`);
      } else {
        //console.log(`wrote metadata to file ${tempFile.name}`);
        // return the temp file location
        resolve(tempFile.name);
      }
    });
  });
}

// make sure the new file got the right info
function verifyNewFile(fileName: string, url: string, copyright: string): Promise<void> {
  // get the updated file tags
  return (
    getFileTags(fileName)
      // and parse that
      .then((jsonData) => parseMetadataTags(jsonData))
      .then((metadataTags) => {
        return new Promise((resolve, reject) => {
          if (url === metadataTags.url && copyright === metadataTags.copyright) {
            console.log(`${url}, ${copyright} ✅`);
            resolve();
          } else {
            console.log(`${metadataTags.url}, ${metadataTags.copyright} ❌`);
            console.log(`expected: ${url}, ${copyright}`);
            reject('metadata did not update correctly');
          }
        });
      })
  );
}

// output the file info to the console
async function modifyFileInfo(file: string, tags: MetadataTags): Promise<void> {
  const artistAndAlbum = chalk.green.bold(`${tags.artist} – ${tags.title}`);
  console.log(`Modifying ${artistAndAlbum}...`);
  // get URL and copyright info if needed
  const updateInfo = await getArtistInfo(tags.artist);
  // show what is going to happen
  //console.log(`url: ${tags.url} --> ${updateInfo.url}`);
  //console.log(`copyright: ${tags.copyright} --> ${updateInfo.copyright}`);
  // write metadata which creates a new file because of how ffmpeg works
  const newFile = await writeMetadata(file, updateInfo.url, updateInfo.copyright);
  await verifyNewFile(newFile, updateInfo.url, updateInfo.copyright);
  // move the new file to the original file
  console.log(`${newFile} -> ${file}`);
  fs.renameSync(newFile, file);
}

getInputFiles()
  .then((audioFiles) => modifyFiles(audioFiles))
  .catch((err) => {
    console.error(`Error: ${err}`);
    process.exit(1);
  })
  .finally(() => {
    READLINE_INTERFACE.close();
  });
