const { BEST_PRICE_DIFF } = require('./constants')
const fs = require('fs')
const yaml = require('js-yaml')
const stringify = require('csv-stringify')
const _ = require('lodash')

const {
  createWorkingDirectory,
  getDestinationFolder,
  parsePrice,
  getAbsoluteLink,
  mergeItemsWithYAnalog,
  cleanName: cleanItemName
} = require('./utils')

async function createCSVFromFolderFiles() {
  const items = readAllItemsFromFolder(getDestinationFolder())

  const bestPriceItems = getBestPriceItems(items)

  const csvItems = await formatItemsIntoCsvFormat(bestPriceItems)

  return csvItems
}

async function createCSVFromItems(items) {
  const bestPriceItems = getBestPriceItems(items)

  const csvItems = await formatItemsIntoCsvFormat(bestPriceItems)

  return csvItems
}

function transformIntoPlainObject(item) {
  const mallPrice = _.get(item, 'price')
  const yPrice = _.get(item, 'yProduct.price')
  return {
    mallName: _.get(item, 'name'),
    yName: _.get(item, 'yProduct.name'),
    mallPrice,
    yPrice,
    priceDiff: yPrice - mallPrice,
    mallLink: _.get(item, 'link'),
    yLink: _.get(item, 'yProduct.link'),
    mallImg: _.get(item, 'img'),
    yImg: _.get(item, 'yProduct.img'),
    mallCategories: _.get(item, 'categories')
  }
}

function readAllItemsFromFolder(folderName) {
  const ymlItemRegexp = /^\d{1,4}\-.*/
  const itemFiles = fs.readdirSync(folderName)
    .filter(fileName => !fs.statSync(getDestinationFolder(fileName)).isDirectory())
    .filter(fileName => ymlItemRegexp.test(fileName))

  const items = itemFiles
    .map(fileName => yaml.safeLoad(
      fs.readFileSync(getDestinationFolder(fileName), 'utf8'),
      {schema: yaml.DEFAULT_FULL_SCHEMA}
    ))

  return items
}

function getBestPriceItems(items, priceDiff=BEST_PRICE_DIFF) {
  const bestPriceItems = items
    .filter(item => {
      const priceDiff = _.get(item, 'yProduct.price', 0) -
                        _.get(item, 'price', 0)
      return priceDiff > BEST_PRICE_DIFF
    })

  return bestPriceItems
}

function getCsvColumns() {
  const columns = {
    mallName: 'mallName',
    yName: 'yandexName',
    mallPrice: 'mallPrice',
    yPrice: 'yandexPrice',
    priceDiff: 'priceDiff',
    mallCategories: 'categories',
    mallLink: 'mallLink',
    yLink: 'yandexLink',
    mallImg: 'mallImage',
    yImg: 'yandexImage'
  }

  return columns
}

function formatItemsIntoCsvFormat(items) {
  const transformedItems = items.map(transformIntoPlainObject)

  return new Promise((resolve, reject) => {
    const csvOptions = {
      columns: getCsvColumns(),
      header: true,
      delimiter: '\t'
    }

    stringify(transformedItems, csvOptions, (err, output) => {
      if (err) {
        console.log('Csv formation error: ', err)
        reject(err)
      }
      resolve(output)
    })
  })
}

// exports.createCSV = createCSV
exports.createCSVFromFolderFiles = createCSVFromFolderFiles
