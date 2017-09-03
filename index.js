const fetch = require('node-fetch')
const jquery = require('jquery')
const jsdom = require('jsdom')
const { JSDOM } = jsdom
const Horseman = require('node-horseman');

const MALL_URL = 'https://mall.aliexpress.com/'

// const getCategories = html => getCategoriesFromPage(html, parseCategories)

getPageSourceByHorseman(
  MALL_URL,
  getCategoriesFromPage,
  {selectorToWait: '.categories-list-box > .cl-item'}
)

// function getCategoryItems(category, callback) {
// }

// function parseCategories(categories=[]) {
//   items = categories.map(category, (category) => {
//     const subCategories = category.categories

//     let categoryItems = []

//     items = subCategories.map(subCategory => {
//       categoryPageSourse = getPageSource(subCategory.link)
//     })
//   })
// }

/**
 * Get page html by Horseman
 *
 * Some pages have to execute inners scripts to fill
 * menu categories (for example on index page)
 *
 * If you don't need to execute page js then use node-fetch
 */
function getPageSourceByHorseman(url, callback, options={}) {
  const horseman = new Horseman();

  const { selectorToWait = '' } = options

  horseman
    .userAgent('Mozilla/5.0 (Windows NT 6.1; WOW64; rv:27.0) Gecko/20100101 Firefox/27.0')
    .open(url)
    .waitForSelector(selectorToWait)
    .html()
    .close()
    .then(callback)
}

/**
 * Get page html by node-fetch
 *
 * If you need to execute page js then @see getPageSourceByHorseman
 */
function getPageSource(url, callback) {
  fetch(url)
    .then(res => res.text())
    .then(body => callback(body))
}

function getCategoriesFromPage(html) {
  console.log(html)
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

  console.log(JSON.stringify(items, null, 2))

}

