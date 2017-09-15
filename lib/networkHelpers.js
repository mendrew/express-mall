const fetch = require('node-fetch')
const Horseman = require('node-horseman')

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

exports.getPageSourceByHorseman = getPageSourceByHorseman
exports.getPageSource = getPageSource
