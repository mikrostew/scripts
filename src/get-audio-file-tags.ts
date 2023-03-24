// get the metadata tags for a single input file using ffprobe

import { spawn } from 'child_process';

// get the input file location from the arguments to this script
function getInputFile(): Promise<string> {
  return new Promise((resolve, reject) => {
    // argv[0] is node
    // argv[1] is this script
    // argv[2] is the file argument
    if (process.argv.length < 3) {
      reject('must input a filename');
    } else {
      resolve(process.argv[2]);
    }
  });
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

// output the tag info to the console
function outputTagInfo(tags: MetadataTags): Promise<void> {
  return new Promise((resolve) => {
    // this is all I need to do
    console.log(JSON.stringify(tags));
    resolve();
  });
}

getInputFile()
  .then((filename) => getFileTags(filename))
  .then((jsonData) => parseMetadataTags(jsonData))
  .then((metadataTags) => outputTagInfo(metadataTags))
  .catch((err) => {
    console.error(`Error: ${err}`);
    process.exit(1);
  });
