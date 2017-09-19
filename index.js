const fetch = require('node-fetch')
const jquery = require('jquery')
const _ = require('lodash')
const jsdom = require('jsdom')
const { JSDOM } = jsdom
const Horseman = require('node-horseman')
const yaml = require('js-yaml');
const fs = require('fs');
const url = require('url');
const parseNum = require('parse-num')
const HttpsProxyAgent = require('https-proxy-agent');
const FuzzySet = require('fuzzyset.js')
const Promise = require('bluebird')
const stringify = require('csv-stringify');

const { getMallItems } = require('./lib/mallHelpers')
const { getYItem } = require('./lib/yHelpers')
const { createCSV } = require('./lib/csvHelpers')

const {
  BEST_PRICE_DIFF,
  MALL_ITEMS_SLICE_LIMIT,
  TIME,
  SESSION_FOLDER,
  MALL_URL,
  Y_URL
} = require('./lib/constants')

const {
  createWorkingDirectory,
  getDestinationFolder,
  parsePrice,
  getAbsoluteLink,
  mergeItemsWithYAnalog,
  cleanName: cleanItemName
} = require('./lib/utils')

const { getPageSourceByHorseman } = require('./lib/networkHelpers')

createWorkingDirectory()


main()

// testFunc()

async function main() {

  const mallItems = await getMallItems({readFromFile: false})

  const items = mallItems.slice(...MALL_ITEMS_SLICE_LIMIT)

  const resultProductsForCompare = await Promise
    .mapSeries(items, async (item, index) => {

    const yItem = await getYItem(item, index)

    const product = mergeItemsWithYAnalog(item, yItem, index)

    return product
  })

  fs.writeFileSync(getDestinationFolder('compareResultMain100.json'), yaml.dump(resultProductsForCompare));

  const outputCsv = await createCSVFromFolderFiles()

  console.log("Csv result: ", outputCsv)
  fs.writeFileSync(getDestinationFolder('result.csv'), outputCsv);

  return true
}

async function testFunc() {
  const outputCsv = await createCSV('368-philipsBhb86900', 'some.csv')
  console.log(outputCsv)
  fs.writeFileSync(getDestinationFolder('result.csv'), outputCsv);

  return true
}



