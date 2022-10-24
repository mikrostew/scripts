// Download a file, using hooks from the input plugin

import fs from 'fs';
import http from 'http';
import https from 'https';
import fetch from 'node-fetch';
import { JSDOM } from 'jsdom';

// for downloading a single file to a variable
async function downloadAsString(url: string): Promise<string> {
  const response = await fetch(url);
  const body = response.text();
  return body;
}

// for downloading to a file
async function downloadToFile(url: string, filePath: string): Promise<void> {
  const fileStream = fs.createWriteStream(filePath);
  const options = {
    headers: {
      // user-agent from my local browser
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:106.0) Gecko/20100101 Firefox/106.0',
    },
  };

  return new Promise((resolve) => {
    // TODO: have to choose http|https based on the URL
    const request = http.get(url, options, (response) => {
      // handle redirect
      if (response.statusCode === 302) {
        const newLocation = response.headers.location;
        //console.log(`Redirect - new location is ${newLocation}`);
        if (newLocation === undefined) {
          throw new Error(`Got a redirect, but there was no location header!\n${response.headers}`);
        }
        const reRequest = https.get(newLocation, options, (reResponse) => {
          // TODO: handle redirect here? go recursive?
          if (reResponse.statusCode !== 200) {
            throw new Error(`Failed to GET '${newLocation}' (status: ${reResponse.statusCode})`);
          }
          // pipe this download stream to the file
          reResponse.pipe(fileStream);
        });

        reRequest.on('error', (err) => {
          fs.unlink(filePath, () => {
            throw err;
          });
        });

        // do the reqest
        reRequest.end();
      } else if (response.statusCode !== 200) {
        throw new Error(`Failed to GET '${url}' (status: ${response.statusCode})`);
      } else {
        // pipe the download stream to the file
        response.pipe(fileStream);
      }
    });

    request.on('error', (err) => {
      fs.unlink(filePath, () => {
        throw err;
      });
    });

    // don't resolve on the end of the response
    // wait to resolve until this finishes, which is after the response completes
    fileStream.on('finish', () => {
      resolve();
    });

    fileStream.on('error', (err) => {
      fs.unlink(filePath, () => {
        throw err;
      });
    });

    // do the reqest
    request.end();
  });
}

// wrapped so I can use await in this
(async () => {
  // TODO: factor this plugin stuff out to a function

  // one argument - plugin to use
  const args = process.argv.slice(2);
  const pluginPath = args[0];
  if (pluginPath === undefined || pluginPath === '') {
    // TODO: better error for this
    console.error('Must supply path to plugin');
  }

  const plugin = require(pluginPath);
  // check that functions are defined
  let numPluginFnErrors = 0;
  ['inputUrl', 'findLinkInFrag', 'downloadFilePath'].forEach((fn) => {
    if (typeof plugin[fn] !== 'function') {
      console.error(`Plugin '${pluginPath}' does not implement '${fn}'`);
      numPluginFnErrors++;
    }
  });
  if (numPluginFnErrors > 0) {
    process.exit(1);
  }

  // download the main page, and convert to JSDOM fragment
  const htmlContents = await downloadAsString(plugin.inputUrl());
  const frag = JSDOM.fragment(htmlContents);

  // use the plugin to figure out what to download, and where to save it
  const downloadLink = plugin.findLinkInFrag(frag);
  const downloadFilePath = plugin.downloadFilePath();

  // save to file
  await downloadToFile(downloadLink, downloadFilePath);

  console.log(`Downloaded to ${downloadFilePath}`);

  // TODO: could additionally attach to an email
})();
