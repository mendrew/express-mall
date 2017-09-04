const fetch = require('node-fetch')
const jquery = require('jquery')
const jsdom = require('jsdom')
const { JSDOM } = jsdom
const Horseman = require('node-horseman')

const MALL_URL = 'https://mall.aliexpress.com/'

parseMall()

async function parseMall() {
  const pageHtml = await getPageSourceByHorseman(
    MALL_URL,
    {selectorToWait: '.categories-list-box > .cl-item'}
  )

  const categories = getCategoriesFromPage(pageHtml)
  // console.log(categories)
  const result = await parseCategories(categories)
  console.log(result.length)

  return true
}

function getCategoryItems(category, callback) {
}

function parseCategories(categories=[]) {
  const items = categories.map(async (category) => {
    const subCategories = category.categories

    let categoryItems = []

    const subCatItems = subCategories.map(async (subCategory) => {

      // add link check to prevent errors
      const categoryPageSourse = await getPageSource(subCategory.link)
    })
    return await Promise.all(subCatItems)
  })

  return Promise.all(items)
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
      const categoryLink = $(subCategory).attr('href')
      let categoryName = $(subCategory).text().trim()
      const groupNameMatch = categoryLink.match(/group\/(\w+)\//)
      if (!categoryName && groupNameMatch && groupNameMatch.length) {
        categoryName = groupNameMatch[1]
      }

      let category = {name: categoryName, link: categoryLink}

      if (!categoryName) {
        const categoryImg = $(subCategory).find('img').attr('src')
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

