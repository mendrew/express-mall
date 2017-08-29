const Horseman = require('node-horseman');
const horseman = new Horseman();

const fs = require('fs');
const url = require('url');
const sha1 = require('sha1');
const yaml = require('js-yaml');

function getProductLinks() {

  const $productTags = $('.prime-list').find('.item-box .detail-box a');

  const productList = $.map($productTags, function(product, i) {
    return {
      title: $(product).attr('title'),
      link: $(product).attr('href'),
    };
  });

  return productList;
}

function createProductList(products) {
  console.log("trying to create productList", products);
  productList = products.map(product => {
    const pathname = url.parse(product.link).pathname;
    return {
      ...product,
      pathname,
      id: sha1(pathname)
    }
  });

  return Promise.resolve(productList);

}

function saveProductList(products) {
  console.log(products);
  fs.writeFileSync('productList.txt', JSON.stringify(products, null, 2));
  fs.writeFileSync('productList.yaml', yaml.dump(products));

  return Promise.resolve(products);
}

function getProductList() {
  let links = [];
  return horseman
    .userAgent('Mozilla/5.0 (Windows NT 6.1; WOW64; rv:27.0) Gecko/20100101 Firefox/27.0')
    .open('https://mall.aliexpress.com/')
    .status()
    .log()
    .evaluate(getProductLinks)
    .then(createProductList)
    .then(saveProductList)
    .then((products) => {
      links = products;
      return Promise.resolve(products);
    })
    .catch((err) => console.log(err))
    .close()
    .then(() => Promise.resolve(links))
}

exports.getProductList = getProductList;
