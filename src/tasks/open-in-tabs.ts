import execa from 'execa';
import { ConfigTask } from '@mikrostew/good-morning';
import { func } from '@mikrostew/good-morning/lib/plugins';

const tabContext = 'open-tabs';

export function getOpenTabs(): ConfigTask {
  return func('Get open tabs', 'inherit', (ctx) => {
    // this is kinda slow, oh well
    const chromeOpenTabs = new Map(
      execa
        .sync('chrome-tabs')
        .stdout.split('\n')
        .map((tab) => {
          // special case for google docs URLs, remove the '#' and everything after
          if (/docs.google.com/.test(tab)) {
            const hashPosition = tab.indexOf('#');
            if (hashPosition > 0) {
              return tab.substring(0, hashPosition);
            }
          }
          return tab;
        })
        .map((t) => {
          return [t, true];
        })
    );
    // set that in the context so I can use it in the following function
    ctx[tabContext] = chromeOpenTabs;
  });
}

export function openInTab(name: string, url: string): ConfigTask {
  return func(name, 'inherit', (ctx) => {
    if (!ctx[tabContext].get(url)) {
      return execa('open', [url]);
    }
  });
}
