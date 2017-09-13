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

const MALL_URL = 'https://mall.aliexpress.com/'
const Y_URL = 'https://market.yandex.ru/'

const BEST_PRICE_DIFF = 1000 //rub

const TIME = (new Date).toISOString()

const SESSION_FOLDER = `SESSION_${TIME}`

if (!fs.existsSync(getDestinationFolder())) {
  fs.mkdirSync(getDestinationFolder())
}

// parseMall()

testFunc()

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


function getYQuery(search) {
  return `https://market.yandex.ru/search?text=${search}&local-offers-first=1&deliveryincluded=0&onstock=1`
}

async function parseMall() {
  const pageHtml = await getPageSourceByHorseman(
    MALL_URL,
    {selectorToWait: '.categories-list-box > .cl-item'}
  )

  const categories = getCategoriesFromPage(pageHtml)
  fs.writeFileSync(
    getDestinationFolder('categoriesMain.yaml'),
    yaml.dump(categories)
  );

  // // const categories = yaml.safeLoad(fs.readFileSync('categoriesMain.yaml', 'utf8'));

  const itemsLinks = await parseCategories(categories)
  console.log(JSON.stringify(itemsLinks, null, 2))
  console.log(`Items number: ${itemsLinks.length}`)
  fs.writeFileSync(getDestinationFolder('itemsMain.yaml'), yaml.dump(itemsLinks));

  // const itemsLinks = yaml.safeLoad(fs.readFileSync(getDestinationFolder('itemsMain.yaml'), 'utf8'), {schema: yaml.DEFAULT_FULL_SCHEMA})

  const items = itemsLinks.slice()
  const resultProductsForCompare = await Promise.mapSeries(items, async (item, index) => {
    return await fillByYProducts(item, index)
  })
  console.log("Result: ", resultProductsForCompare)

  fs.writeFileSync(getDestinationFolder('compareResultMain100.json'), yaml.dump(resultProductsForCompare));

  return true
}


/**
 * Get page html by Horseman
 *
 * Some pages have to execute inners scripts to fill
 * menu categories (for example on index page)
 *
 * If you don't need to execute page js then use node-fetch
 */
function getPageSourceByHorseman(url, options={}) {
  return new Promise((resolve, reject) => {
    const horseman = new Horseman();

    const { selectorToWait = 'body' } = options

    horseman
      .userAgent('Mozilla/5.0 (Windows NT 6.1; WOW64; rv:27.0)'
        + ' Gecko/20100101 Firefox/27.0')
      .open(url)
      .waitForSelector(selectorToWait)
      .wait(Math.floor(Math.random()*1000))
      .screenshot('captcha.png')
      .mouseEvent(
        'mousemove',
        Math.floor(Math.random()*1000),
        Math.floor(Math.random()*1000)
      )
      .wait(Math.floor(Math.random()*1000))
      .html()
      .close()
      .then(resolve)
      .catch(reject)
  })
}

/**
 * Get page html by node-fetch
 *
 * If you need to execute page js then @see getPageSourceByHorseman
 */
function getPageSource(url) {
  return new Promise((resolve, reject) => {
    // fetch(url, { agent:new HttpsProxyAgent('http://165.227.124.179:3128')})
    fetch(url)
      .then(res => res.text())
      .then(body => resolve(body))
      .catch(reject)
  })
}

function getCategoriesFromPage(html) {
  const document = new JSDOM(html)
  const $ = jquery(document.window)

  const $categories = $('.categories-list-box').find('> .cl-item')
  console.log('Categories: ', $categories)
  const items = $.map($categories, (category) => {
    const categoryName = $(category).find('.cate-name span').first().text().trim()

    const $subCategories = $(category).find('a')

    const subCategories = $.map($subCategories, (subCategory) => {

      const categoryLink = getAbsoluteLink($(subCategory).get(0).href)
      if (!categoryLink) {
        return
      }

      let categoryName = $(subCategory).text().trim()
      const groupNameMatch = categoryLink.match(/group\/(\w+)\//)
      if (!categoryName && groupNameMatch && groupNameMatch.length) {
        categoryName = groupNameMatch[1]
      }

      let category = {name: categoryName, link: categoryLink}

      if (!categoryName) {

        const categoryImg = getAbsoluteLink($(subCategory).find('img').attr('src'))
        if (categoryImg) {
          category.img = categoryImg
        }
      }

      return category
    })

    return {name: categoryName, categories: subCategories}
  })

  return items
}

async function parseCategories(categories=[]) {
  let categoryItems = []
  const items = categories.map(async (category) => {
    const subCategories = category.categories


    const subCatItemsPromises = subCategories.map(async (subCategory) => {

      const categoryPageSource = await getPageSource(subCategory.link)

      const hostname = url.parse(subCategory.link).hostname;
      const ignoreCategory = hostname.includes('sale')
      if (ignoreCategory) {
        return
      }

      const categoriesList = [category.name, subCategory.name]

      const items = getItemsFromPage(categoryPageSource, categoriesList)

      return items
    })

    const subCatItems = await Promise.all(subCatItemsPromises)
    subCatItems.map((item) => {
      categoryItems = categoryItems.concat(item)
    })
  })

  const subCategoryItemsList = await Promise.all(items)
  return categoryItems
}

function getItemsFromPage(html, categories) {
  const document = new JSDOM(html)
  const $ = jquery(document.window)

  const $items = $('.list-items').find('.list-item')

  console.log("Items: ", $items.length)
  const items = $.map($items, (item) => {
    const name = $(item).find('.history-item.product').attr('title')

    const link = getAbsoluteLink(
      $(item).find('.history-item.product').get(0).href)

    if (!link) {
      return
    }

    const priceString = $(item)
      .find('.price .value')
      .not('.price-before-discount,.price-del')
      .text()
    const price = parsePrice(priceString)

    const img = getAbsoluteLink($(item).find('img').attr('src'))

    return { name, link, price, img, categories}
  })

  return items
}

async function fillByYProducts(product, index) {
  if (!_.get(product, 'name')) {
    return
  }

  const cleanName = product.name.replace(/[^a-zA-Z0-9\\\\/\ \-]/g, '').trim()
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
  const resultProduct = {
    ...product,
    yProduct: yProduct
  }

  fs.writeFileSync(getDestinationFolder(`${index}-${_.camelCase(cleanName)}`), yaml.dump(resultProduct));

  return resultProduct
  // return {
  //   ...product,
  //   yProduct: yProduct
  // }
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

function getDestinationFolder(fileName) {
  const SESSION_FOLDER = 'SESSION_2017-09-12T22:22:40.009Z'

  if (!fileName) {
    return SESSION_FOLDER
  }
  return `${SESSION_FOLDER}/${fileName}`
}

function parsePrice(priceString) {
  const price = parseNum(priceString, ',')

  if (isNaN(price)) {
    return 0
  }

  return price
}

function getAbsoluteLink(address, from = MALL_URL) {
  if (!address) {
    return
  }

  const link = url.resolve(from, address)
  if (link.startsWith('http')) {
    return link
  }
}

 // Execute a list of Promise return functions in series
function pseries(list) {
  var p = Promise.resolve();
  return list.reduce(function(pacc, fn) {
    return pacc = pacc.then(fn);
  }, p);
}

function createCSV(fileName, outFileName) {
  // const items = yaml.safeLoad(
  //   fs.readFileSync(getDestinationFolder(fileName), 'utf8'),
  //   {schema: yaml.DEFAULT_FULL_SCHEMA}
  // )

  const ymlItemRegexp = /^\d{1,4}\-.*/
  const itemFiles = fs.readdirSync(getDestinationFolder())
    .filter(fileName => !fs.statSync(getDestinationFolder(fileName)).isDirectory())
    .filter(fileName => ymlItemRegexp.test(fileName))

  const items = itemFiles
    .map(fileName => yaml.safeLoad(
      fs.readFileSync(getDestinationFolder(fileName), 'utf8'),
      {schema: yaml.DEFAULT_FULL_SCHEMA}
    ))

  const bestPriceItems = items
    .filter(item => {
      const priceDiff = _.get(item, 'yProduct.price', 0) -
                        _.get(item, 'price', 0)
      return priceDiff > BEST_PRICE_DIFF
    })

  console.log(bestPriceItems[0])

  const formattedItems = bestPriceItems.map(transformIntoPlainObject)
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
  return new Promise((resolve, reject) => {
    stringify(formattedItems, {columns: columns, header: true, delimiter: '\t'}, (err, output) => {
      if (err) {
        console.log(err)
        reject(err)
      }
      resolve(output)
    })
  })

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
