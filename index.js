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

const {
  BEST_PRICE_DIFF, TIME, SESSION_FOLDER, MALL_URL, Y_URL
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

const createCSV = require('./lib/csvHelpers')

parseMall()

// testFunc()

async function testFunc() {
  // const link = 'https://market.yandex.ru/search?text=LG%20K8%20K350E&local-offers-first=1&deliveryincluded=0&onstock=1'
  // const resultLink = url.resolve(MALL_URL, link)
  // console.log("Result link: ", resultLink)
  // const pageSource = await getPageSource(resultLink)
  // fs.writeFileSync('page.html', pageSource);
  // console.log(pageSource)

  // const items = yaml.safeLoad(fs.readFileSync('items.yaml', 'utf8'), {schema: yaml.DEFAULT_FULL_SCHEMA}).slice(0, 3);

  // const resultProductsForCompare = await Promise.mapSeries(items, async (item, index) => {
  //   return await fillByYProducts(item, index)
  // })
  // debugger
  // const productsForCompare = await fillByYProducts(items[1], 1)
  // console.log(JSON.stringify(productsForCompare, null, 2))
  // fs.writeFileSync('compareResultTimePart.json', JSON.stringify(productsForCompare, null, 2));

  // console.log(JSON.stringify(resultProductsForCompare, null, 2))

  // fs.writeFileSync('compareResultTime.json', JSON.stringify(resultProductsForCompare, null, 2));

  const outputCsv = await createCSV('368-philipsBhb86900', 'some.csv')
  console.log(outputCsv)
  fs.writeFileSync(getDestinationFolder('result.csv'), outputCsv);

  return true
}



async function parseMall() {

  const mallItems = await getMallItems()

  const items = mallItems.slice(0, 3)

  const resultProductsForCompare = await Promise.mapSeries(items, async (item, index) => {
    const yItem = await getYItem(item, index)

    const product = mergeItemsWithYAnalog(item, yItem, index)

    return product
  })
  console.log("Result: ", resultProductsForCompare)

  fs.writeFileSync(getDestinationFolder('compareResultMain100.json'), yaml.dump(resultProductsForCompare));

  return true
}
