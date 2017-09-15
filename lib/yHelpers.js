const _ = require('lodash')
const fs = require('fs')
const jquery = require('jquery')
const jsdom = require('jsdom')
const { JSDOM } = jsdom
const FuzzySet = require('fuzzyset.js')

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

  debugger
  const itemTitles = $.map($items, (item) => {
    return $(item).find('.n-snippet-card2__title,.snippet-card__header').text().toLowerCase()
  })

  let productTitleIndex = itemTitles.findIndex((title) => {
    return title.includes(cleanName.toLowerCase())
  })

  if (productTitleIndex < 0) {
    const fuzzyTitles = new FuzzySet()
    itemTitles.forEach(title => fuzzyTitles.add(title.slice(0, cleanName.length)))

    const fuzzyResults = fuzzyTitles.get(cleanName.toLowerCase(), null, 0.1)
    console.log('Title: ', cleanName.toLowerCase(), "\nTitles: ", itemTitles, "\nFuzzy Res: ", fuzzyResults)
    if (!fuzzyResults) {
      return
    }

    const fuzzySorted = fuzzyResults.sort((a, b) => a[0] < b[0])
    const matchedTitle = _.get(fuzzySorted, '[0][1]')


    productTitleIndex = itemTitles.findIndex((title) => {
      return title.includes(matchedTitle)
    })
  }

  if (productTitleIndex < 0) {
    return
  }

  const $yProduct = $items.eq(productTitleIndex)

  const yProduct = getYProductOptions($, $yProduct)

  console.log('**************\n', yProduct, '\n**************\n')


  return yProduct
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

function getYQuery(search) {
  return `https://market.yandex.ru/search?text=${search}&local-offers-first=1&deliveryincluded=0&onstock=1`
}

exports.getYItem = getYItem
