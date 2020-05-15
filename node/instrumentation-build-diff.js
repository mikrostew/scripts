/* eslint no-param-reassign: 0, no-console: 0, no-process-exit: 0, no-sync: 0 */

// Read 2 reports produced by instrumentation-self-time.js, and find the differences

// Run like:
//  node instrumentation-build-diff.js <basename1> <basename2>

const fs = require('fs')

// for cases where the builds are not done in the same directories
// TODO: make these more configurable
const BEFORE_DIRECTORY = '/Users/mistewar/src/repro/voyager-web_trunk-before'
const AFTER_DIRECTORY = '/Users/mistewar/src/repro/voyager-web_trunk-after'
const BEFORE_BROCCOLI_DIR = '/var/folders/2_/30gdkxy15px5zkj31mp58psc000lnr/T/broccoli-98099AtBTPddQge1j'
const AFTER_BROCCOLI_DIR = '/var/folders/2_/30gdkxy15px5zkj31mp58psc000lnr/T/broccoli-8374kr0PrEkUe90N'

const files = process.argv.slice(2)

if (files.length !== 2) {
  console.error('Error: expected 2 arguments')
  console.error('')
  console.error('Usage:')
  console.error('  node instrumentation-build-diff.js <basename1> <basename2>')
  console.error('')
  console.error('Example:')
  console.error('  node instrumentation-build-diff.js instrumentation-1.command.json instrumentation-2.command.json')
  console.error('would compare:')
  console.error(' `instrumentation-1.command.json-combined.json` and `instrumentation-2.command.json-combined.json`')
  console.error(' `instrumentation-1.command.json-selftime.json` and `instrumentation-2.command.json-selftime.json`')
  process.exit(1)
}

// read stats output from instrumentation-self-time.js
function readStatsFile (filename) {
  const jsonData = JSON.parse(fs.readFileSync(filename, 'utf8'))
  const statData = {}
  jsonData.forEach(node => statData[node.id] = node)
  return statData
}

// write JSON out to a file
function writeToFile (filename, jsonContents) {
  console.log(`Writing file '${ filename }'`)
  fs.writeFileSync(filename, JSON.stringify(jsonContents, null, 2))
}

// order objects by descending self time, and store in an array
function orderByTime (jsonObject) {
  const convertToArray = Object.keys(jsonObject).map(k => jsonObject[k])
  // sort descending order by self time
  const sortedStats = convertToArray.sort((a, b) => b.selftime - a.selftime)
  return sortedStats
}


// first, the combined stats

const combinedFile1 = `${ files[0] }-combined.json`
const combinedFile2 = `${ files[1] }-combined.json`
console.log(`Comparing '${ combinedFile1 }' and '${ combinedFile2 }'...`)

const combinedStats1 = readStatsFile(combinedFile1)
const combinedStats2 = readStatsFile(combinedFile2)

const combinedDiff = {}
Object.keys(combinedStats1).forEach(node => {
  combinedDiff[node] = {
    id: node,
    time: combinedStats2[node].time - combinedStats1[node].time,
    calls: combinedStats2[node].calls - combinedStats1[node].calls,
    percent: combinedStats2[node].percent - combinedStats1[node].percent,
  }
})

// write that out to a file
writeToFile('combined-diff.json', combinedDiff)


// then, the stats for each node

const selfTimeFile1 = `${ files[0] }-selftime.json`
const selfTimeFile2 = `${ files[1] }-selftime.json`
console.log(`Comparing '${ selfTimeFile1 }' and '${ selfTimeFile2 }'...`)

const selfTimeStats1 = readStatsFile(selfTimeFile1)
const selfTimeStats2 = readStatsFile(selfTimeFile2)

const selfTimeDiff = {}
const selfTimeGone = {}
const selfTimeAdded = {}

// any nodes that changed, or were removed
Object.keys(selfTimeStats1).forEach(node => {
  // if the builds were done in different directories, some of these will be different
  // (because the full paths are included in the node ID)
  // and, the broccoli output dirs will also be different
  const beforeNode = node
  const afterNode = node.replace(BEFORE_DIRECTORY, AFTER_DIRECTORY).replace(BEFORE_BROCCOLI_DIR, AFTER_BROCCOLI_DIR)
  const normalizedNode = node.replace(BEFORE_DIRECTORY, '<build-dir>').replace(BEFORE_BROCCOLI_DIR, '<broccoli-dir>')

  if (selfTimeStats1[beforeNode] !== undefined && selfTimeStats2[afterNode] !== undefined) {
    // both before and after have it, all good
    selfTimeDiff[normalizedNode] = {
      id: normalizedNode,
      selftime: selfTimeStats2[afterNode].selftime - selfTimeStats1[beforeNode].selftime,
      // preserve the selftime info, because that's useful to see how big of a change this is
      originalSelfTime: selfTimeStats1[beforeNode].selftime,
      newSelfTime: selfTimeStats2[afterNode].selftime,
      calls: selfTimeStats2[afterNode].calls - selfTimeStats1[beforeNode].calls,
      percent: selfTimeStats2[afterNode].percent - selfTimeStats1[beforeNode].percent,
    }
  } else if (selfTimeStats2[afterNode] === undefined) {
    // missing in the after build
    selfTimeGone[normalizedNode] = selfTimeStats1[beforeNode]
    selfTimeGone[normalizedNode].id = normalizedNode
  }
})

// any nodes that were added
Object.keys(selfTimeStats2).forEach(node => {
  // (same idea as above)
  const afterNode = node
  const beforeNode = node.replace(AFTER_DIRECTORY, BEFORE_DIRECTORY).replace(AFTER_BROCCOLI_DIR, BEFORE_BROCCOLI_DIR)
  const normalizedNode = node.replace(AFTER_DIRECTORY, '<build-dir>').replace(AFTER_BROCCOLI_DIR, '<broccoli-dir>')

  if (selfTimeStats1[beforeNode] === undefined) {
    // added in the after build
    selfTimeAdded[normalizedNode] = selfTimeStats2[afterNode]
    selfTimeAdded[normalizedNode].id = normalizedNode
  }
})

// order by time
const selfTimeDiffArray = orderByTime(selfTimeDiff)
const selfTimeGoneArray = orderByTime(selfTimeGone)
const selfTimeAddedArray = orderByTime(selfTimeAdded)

// write those out to files
writeToFile('selftime-diff.json', selfTimeDiffArray)
writeToFile('selftime-gone.json', selfTimeGoneArray)
writeToFile('selftime-added.json', selfTimeAddedArray)
