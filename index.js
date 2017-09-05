const fetch = require('node-fetch')
const jquery = require('jquery')
const jsdom = require('jsdom')
const { JSDOM } = jsdom
const Horseman = require('node-horseman')
const yaml = require('js-yaml');
const fs = require('fs');
const url = require('url');
const parseNum = require('parse-num')

const MALL_URL = 'https://mall.aliexpress.com/'

parseMall()

// testFunc()

async function testFunc() {
  const link = 'about:blank#'
  const resultLink = url.resolve(MALL_URL, link)
  console.log("Result link: ", resultLink)
  const pageSource = await getPageSource(resultLink)
  console.log(pageSource)
}

async function parseMall() {
  // const pageHtml = await getPageSourceByHorseman(
  //   MALL_URL,
  //   {selectorToWait: '.categories-list-box > .cl-item'}
  // )

  // const categories = getCategoriesFromPage(pageHtml)
  // fs.writeFileSync('categories.yaml', yaml.dump(categories));

  const categories = yaml.safeLoad(fs.readFileSync('categories.yaml', 'utf8'));

  const itemsLinks = await parseCategories(categories)
  console.log(JSON.stringify(itemsLinks, null, 2))

  return true
}

function getCategoryItems(category, callback) {
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

    const { selectorToWait = '' } = options

    horseman
      .userAgent('Mozilla/5.0 (Windows NT 6.1; WOW64; rv:27.0)'
        + ' Gecko/20100101 Firefox/27.0')
      .open(url)
      .waitForSelector(selectorToWait)
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
        const categoryimg = getabsolutelink($(subcategory).find('img').attr('src'))
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


    const subTestCategories = [subCategories[0]]

    const subCatItemsPromises = subTestCategories.map(async (subCategory) => {

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

function parseSaleCatalog($) {
  /*Sale catalog have preload content with latest items
   * has 'sale' in hostname part of url
   * But we can't parse easy, no classes, looks like it's
   * content from somewhere */
  return []
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
