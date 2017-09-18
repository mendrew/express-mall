const url = require('url');
const fs = require('fs')
const yaml = require('js-yaml');
const jquery = require('jquery')
const jsdom = require('jsdom')
const { JSDOM } = jsdom

const { getDestinationFolder, getAbsoluteLink, parsePrice} = require('./utils')
const { MALL_URL } = require('./constants')

const { getPageSourceByHorseman, getPageSource } = require('./networkHelpers')

async function getMallItems({readFromFile = false}) {

  if (readFromFile) {
    try {
      const itemsFromFile = yaml.safeLoad(
        fs.readFileSync(getDestinationFolder('itemsMain.yaml'), 'utf8'),
        {schema: yaml.DEFAULT_FULL_SCHEMA}
      )
      return itemsFromFile
    } catch(e) {
      console.log(`Error while read mall items file`)
    }
  }

  const pageHtml = await getPageSourceByHorseman(
    MALL_URL,
    {selectorToWait: '.categories-list-box > .cl-item'}
  )

  const categories = getCategoriesFromPage(pageHtml)

  fs.writeFileSync(
    getDestinationFolder('mallCategories.yaml'),
    yaml.dump(categories)
  );

  const itemsLinks = await parseCategories(categories)

  fs.writeFileSync(getDestinationFolder('itemsMain.yaml'), yaml.dump(itemsLinks));

  return itemsLinks
}

exports.getMallItems = getMallItems

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
