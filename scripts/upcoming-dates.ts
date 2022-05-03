#!/usr/bin/env ts-node
/* eslint-disable @typescript-eslint/no-non-null-assertion */

// show upcoming dates, from the input config file

import path from 'path';
import os from 'os';
import Table from 'cli-table';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const TODAY = new Date();
const THIS_YEAR = TODAY.getFullYear();
const NEXT_YEAR = THIS_YEAR + 1;

const CONFIG_FILE_NAME = 'upcoming-dates.js';

// format of the config file
type DateConfig = {
  name: string;
  date: string;
  notes?: string;
  anniversary_year?: number;
};

// with some additional info that will be added later
type MostDateConfig = DateConfig & {
  year: number;
  dateObj: Date;
};

type FullDateConfig = MostDateConfig & {
  daysAway: number;
};

// different paths for different machines
function getConfig(): DateConfig[] {
  const hostName = os.hostname();

  let syncDir;
  if (/MacBook-Air/.test(hostName) || /Michaels-Air/.test(hostName)) {
    // home laptop
    syncDir = path.join('/', 'Users', 'mikrostew', 'Sync');
  } else if (/mistewar-mn/.test(hostName)) {
    // work laptop
    syncDir = path.join('/', 'Users', 'mistewar', 'Sync');
  } else {
    throw new Error(`Unknown machine '${hostName}'`);
  }

  const dateConfigs = require(path.join(syncDir, CONFIG_FILE_NAME));
  return dateConfigs;
}

// how many days is the input date from today
function daysFromToday(date: Date): number {
  return Math.ceil((date.getTime() - TODAY.getTime()) / MS_PER_DAY);
}

// is this a recurring date?
function isRecurring(d: string): boolean {
  return d.split('/').length === 2;
}

// convert the input date string and year to a Date object
function toDate(fromStr: string, year: number): Date {
  const parts = fromStr.split('/');
  if (parts.length === 2) {
    // recurring, have to add year
    // (month is zero-index)
    const month = parseInt(parts[0]!, 10) - 1;
    const day = parseInt(parts[1]!, 10);
    return new Date(year, month, day);
  } else if (parts.length === 3) {
    const year = parseInt(parts[0]!, 10);
    // (month is zero-index)
    const month = parseInt(parts[1]!, 10) - 1;
    const day = parseInt(parts[2]!, 10);
    return new Date(year, month, day);
  } else {
    throw new Error(`Unknown date format: '${fromStr}'`);
  }
}

// add some additional fields and possible upcoming dates next year
function addDates(d: DateConfig): MostDateConfig[] | MostDateConfig {
  const newDate: MostDateConfig = Object.assign(
    {
      year: THIS_YEAR,
      dateObj: toDate(d.date, THIS_YEAR),
    },
    d
  );
  // account for recurring dates coming next year
  if (isRecurring(d.date)) {
    const newDate2: MostDateConfig = Object.assign({}, newDate);
    newDate2.year = NEXT_YEAR;
    newDate2.dateObj = toDate(d.date, NEXT_YEAR);
    // normalize dates to YYYY/MM/DD
    newDate.date = `${THIS_YEAR}/${newDate.date}`;
    newDate2.date = `${NEXT_YEAR}/${newDate2.date}`;
    return [newDate, newDate2];
  } else {
    return newDate;
  }
}

// add how many days away to the object
function daysAway(d: MostDateConfig): FullDateConfig {
  const newDate: FullDateConfig = Object.assign(
    {
      daysAway: daysFromToday(d.dateObj),
    },
    d
  );
  return newDate;
}

// is this <= 90 days away?
function inTheNearFuture(d: FullDateConfig): boolean {
  return d.daysAway >= 0 && d.daysAway <= 90;
}

// function to sort the two input dates
function soonestDateFirst(a: FullDateConfig, b: FullDateConfig): number {
  return a.daysAway - b.daysAway;
}

// format the optional fields on this date
function formatNotes(d: FullDateConfig): FullDateConfig {
  // calculate the anniversary number
  const anniversaryNum = d.anniversary_year
    ? `${d.year - d.anniversary_year} year anniversary`
    : undefined;
  // add that to the existing notes, if there are any
  d.notes = [d.notes, anniversaryNum].filter(Boolean).join(', ');
  // if there are any notes, add some brackets around them
  // if (d.notes !== '') {
  //   d.notes = `[${d.notes}]`;
  // }
  return d;
}

// function tableData(data) {
//   return "<td style='border: 1px solid black; padding: 3px;'>" + data + '</td>';
// }

// format the date config to a string
// function formatDate(d: FullDateConfig): string {
//   return `${d.name} (${d.daysAway} days) ${d.dateObj.toLocaleDateString('en-US', {
//     weekday: 'short',
//     month: 'short',
//     day: 'numeric',
//   })} ${d.notes}`;
// }

// printout

console.log('Upcoming Dates');

const dateConfig: DateConfig[] = getConfig();
const something: FullDateConfig[] = dateConfig
  .map(addDates)
  .flat()
  .map(daysAway)
  .filter(inTheNearFuture)
  .sort(soonestDateFirst)
  .map(formatNotes);
// .map(formatDate)
// .forEach((s: string) => console.log(`  ${s}`));

const table = new Table();

for (const blah of something) {
  const dateFormat = blah.dateObj.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  table.push([blah.name, `${blah.daysAway} days`, dateFormat, blah.notes]);
}

console.log(table.toString());
