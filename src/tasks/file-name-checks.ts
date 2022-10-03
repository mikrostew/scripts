import { promises as fsPromises } from 'fs';
import execa from 'execa';
import { ListrContext } from 'listr';

// for checking file names
interface FileCheck {
  // I could maybe simplify this to just be string | RegExp, but that' not expressive enough
  match: ((fileName: string) => boolean) | RegExp | string;
  // string with '{}' placeholder, like "{} bad characters" (like what Rust does)
  errorMsg: `${string}{}${string}`;
}

// check the files in the input directory, setting the contextPropName in the context to true on error
export async function fileNameChecks(
  ctx: ListrContext,
  dirPath: string,
  contextPropName: string
): Promise<void> {
  const dirContents = await fsPromises.readdir(dirPath, {
    withFileTypes: true,
  });
  const fileNames = dirContents
    .filter((f) => !f.isDirectory())
    .map((f) => f.name)
    .filter((name) => name !== '.DS_Store');

  const fileChecks: FileCheck[] = [
    {
      match: /official.*(video|audio)/i,
      errorMsg: '{} official audio/video',
    },
    {
      match: /rename/i,
      errorMsg: '{} (rename)',
    },
    {
      match: /remix/i,
      errorMsg: '{} remix',
    },
    {
      match: /lyric/i,
      errorMsg: '{} lyric',
    },
    {
      match: /\(audio\)/i,
      errorMsg: '{} (audio)',
    },
    {
      match: /visuali[sz]er/i,
      errorMsg: '{} visualizer',
    },
    {
      match: /hq/i,
      errorMsg: '{} hq',
    },
    // https://www.grammarly.com/blog/capitalization-in-the-titles/
    // (prepositions, articles, and conjunctions are not capitalized)
    {
      match: (fname: string) =>
        fname
          .split('-')
          .some(
            (part) =>
              / (Of|A|And|To|The|For|Or|In|On|Out|Up) /.test(part.trim()) &&
              !/The A/.test(part.trim())
          ),
      errorMsg: '{} Of/A/And/To/The/For/Or/In/On/Out/Up',
    },
    {
      match: (fname: string) =>
        fname.split(' ').some((word) => /^[A-Z]{2,}$/.test(word) && !/II/.test(word)),
      errorMsg: '{} all caps',
    },
    {
      // could negate this regex with negative look-ahead, like /^(?!.* - )/, but I will definitely forget that syntax
      // (see https://stackoverflow.com/a/1538524 for instance)
      match: (fname: string) => !/ - /.test(fname),
      errorMsg: '{} no dashes',
    },
    {
      match: /best quality/i,
      errorMsg: '{} best quality',
    },
    {
      match: '  ',
      errorMsg: '{} extra spaces',
    },
    {
      match: (fname: string) =>
        fname.split('-').some((part) => /^[']/.test(part.trim()) || /[']$/.test(part.trim())),
      errorMsg: '{} start/end with quote mark',
    },
  ];

  const failedFiles: Record<string, boolean> = {};
  const errors = fileChecks
    .map((check: FileCheck) => {
      let matchingFiles;
      // what will we use to match?
      const howToMatch = check.match;
      if (typeof howToMatch === 'function') {
        matchingFiles = fileNames.filter(howToMatch);
      } else if (typeof howToMatch === 'string') {
        matchingFiles = fileNames.filter((fname: string) => fname.indexOf(howToMatch) >= 0);
      } else if (howToMatch instanceof RegExp) {
        matchingFiles = fileNames.filter((fname: string) => howToMatch.test(fname));
      } else {
        throw new Error(`unknown type of file check: ${JSON.stringify(check)}`);
      }

      if (matchingFiles.length > 0) {
        // add matching files to set
        for (const fileName of matchingFiles) {
          failedFiles[fileName] = true;
        }
        return check.errorMsg.replace('{}', `${matchingFiles.length}`);
      }
    })
    .filter((error) => error !== undefined);

  if (errors.length > 0) {
    ctx[contextPropName] = true;
    // open the directory in Finder to fix these
    await execa('open', [dirPath]);
    // show error summary, along with file names
    // (show error at end because Listr only shows the last line)
    throw new Error(
      [
        'Some file names had issues',
        Object.keys(failedFiles).sort().join('\n'),
        `Error(s): ${errors.join(', ')}`,
      ].join('\n')
    );
  }
}
