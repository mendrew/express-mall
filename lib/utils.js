const _ = require('lodash')
const yaml = require('js-yaml')
const url = require('url');
const fs = require('fs');
const parseNum = require('parse-num')

const {
   SESSION_FOLDER, MALL_URL, Y_URL
} = require('./constants')

function createWorkingDirectory() {
  if (!fs.existsSync(getDestinationFolder())) {
    fs.mkdirSync(getDestinationFolder())
  }
}

exports.createWorkingDirectory = createWorkingDirectory

function getDestinationFolder(fileName) {
  const SESSION_FOLDER = 'SESSION_2017-09-12T22:22:40.009Z'

  if (!fileName) {
    return SESSION_FOLDER
  }
  return `${SESSION_FOLDER}/${fileName}`
}

exports.getDestinationFolder = getDestinationFolder

function parsePrice(priceString) {
  const price = parseNum(priceString, ',')

  if (isNaN(price)) {
    return 0
  }

  return price
}

exports.parsePrice = parsePrice

function getAbsoluteLink(address, from = MALL_URL) {
  if (!address) {
    return
  }

  const link = url.resolve(from, address)
  if (link.startsWith('http')) {
    return link
  }
}

exports.getAbsoluteLink = getAbsoluteLink

function cleanName(name) {
  if (typeof name !== 'string') {
    return ''
  }

  return name.replace(/[^a-zA-Z0-9\\\\/\ \-]/g, '').trim().toLowerCase()
}
exports.cleanName = cleanName

function mergeItemsWithYAnalog(item, yItem, index='') {
  const resultProduct = {
    ...item,
    yProduct: yItem
  }

  const cleanItemName = cleanName(resultProduct.name)

  fs.writeFileSync(getDestinationFolder(`${index}-${_.camelCase(cleanItemName)}`), yaml.dump(resultProduct));

  return resultProduct
}
exports.mergeItemsWithYAnalog = mergeItemsWithYAnalog
