const _ = require('lodash')
const fs = require('fs')
const jquery = require('jquery')
const jsdom = require('jsdom')
const { JSDOM } = jsdom
const FuzzySet = require('fuzzyset.js')
const Fuse = require('fuse.js')

const { getPageSourceByHorseman } = require('./networkHelpers')
const {
  getDestinationFolder,
  getAbsoluteLink,
  cleanName: cleanItemName,
  parsePrice
} = require('./utils')

const { TIME, Y_URL } = require('./constants')

async function getYItem(product, index) {
  if (!_.get(product, 'name')) {
    return
  }

  const cleanName = cleanItemName(product.name)
  const yUrl = getYQuery(encodeURI(cleanName))
  console.log("Product: ", product.name, " | clean name: ", cleanName)

  let html
  try {
    html = await getPageSourceByHorseman(yUrl)
  } catch (e) {
    console.log("error with product: ", product)
    console.log(yUrl)
    return
  }

  const yBlockUs = html.includes('Нам очень жаль, но&nbsp;запросы, ' +
    'поступившие с&nbsp;вашего IP-адреса, похожи на&nbsp;автоматические')

  if (yBlockUs) {
    console.log("Block happened on product: ", product, "index: ", index)
    return
  }

  fs.writeFileSync(`ypage${TIME}.html`, html);

  if (!html) {
    return
  }

  const document = new JSDOM(html)
  const $ = jquery(document.window)

  const $items = $('.n-snippet-card2,.snippet-card')

  const itemTitles = $.map($items, (item) => {
    return $(item).find('.n-snippet-card2__title,.snippet-card__header').text().toLowerCase()
  })

  const productTitleIndex = getProductTitleIndex(itemTitles, cleanName)

  if (productTitleIndex < 0) {
    return
  }

  const $yProduct = $items.eq(productTitleIndex)

  const yProduct = getYProductOptions($, $yProduct)

  console.log('**************\n', yProduct, '\n**************\n')


  return yProduct
}

function getProductTitleIndex(titleList, title) {
  console.log(JSON.stringify(titleList))
  const cleanTitleList = titleList.map(cleanItemName)
  const cleanTitle = cleanItemName(title)

  const matchedTitle = getTitleMatchIndexByFuseJs(cleanTitleList, cleanTitle)

  const productTitleIndex = cleanTitleList.findIndex((title) => {
    return title.includes(matchedTitle)
  })

  return productTitleIndex
}

function getYProductOptions($, product) {
  if (!product) {
    return
  }

  const priceString = $(product).find('.n-snippet-card2__price,.snippet-card__price').find('.price').text()
  const price = parsePrice(priceString)
  const name = $(product).find('.n-snippet-card2__title,.snippet-card__title,.snippet-card__header').text()
  const rawLink = $(product).find('.n-snippet-card2__title,.snippet-card__title,.snippet-card__header').find('a').get(0).href
  const link = getAbsoluteLink(rawLink, Y_URL)
  const rawImg = $(product).find('.n-snippet-card2__image,.snippet-card__image').find('img').get(0).src
  const img = getAbsoluteLink(rawImg, Y_URL)

  return {
    price,
    name,
    link,
    img
  }
}

function getTitleMatchIndexByFuzzyset(titleList, title) {
  const fuzzyTitles = new FuzzySet()
  titleList.forEach(
    title => fuzzyTitles.add(title.slice(0, title.length))
  )

  const fuzzyResults = fuzzyTitles.get(title.toLowerCase(), null, 0.1)
  console.log('Title: ', title.toLowerCase(), "\nTitles: ", titleList, "\nFuzzy Res: ", fuzzyResults)
  if (!fuzzyResults) {
    return
  }

  const fuzzySorted = fuzzyResults.sort((a, b) => a[0] < b[0])
  const matchedTitle = _.get(fuzzySorted, '[0][1]')

  return matchedTitle
}

function getTitleMatchIndexByFuseJs(titleList, title) {
  const options = {
    id: "id",
    shouldSort: true,
    includeScore: false,
    threshold: 0.6,
    location: 0,
    distance: 100,
    maxPatternLength: 60,
    minMatchCharLength: 1,
    keys: [
      "title"
    ]
  };

  const formattedTitleList = _.map(
    titleList, (title, id) => {return {id, title}})

  const fuse = new Fuse(formattedTitleList, options);

  const result = fuse.search(title)

  const matchedTitleIndex = _.get(result, '[0]')
  _.map(titleList, (title, id) => console.log(`[${id}]: ${title}`))
  console.log("Title: ", title, "\nResult index: ", matchedTitleIndex)

  return matchedTitleIndex
}

function getYQuery(search) {
  return `https://market.yandex.ru/search?text=${search}&local-offers-first=1&deliveryincluded=0&onstock=1`
}

exports.getYItem = getYItem
exports.getProductTitleIndex = getProductTitleIndex
