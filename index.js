const util = require('util');
const fs = require('fs');
const axios = require('axios')
const cheerio = require('cheerio');

const readFile = util.promisify(fs.readFile);

const baseUrl = 'http://www.gaokaopai.com/daxue.html'
const options = {
  headers: {
    'Referer': 'http://www.gaokaopai.com/'
  }
}

const sleep = s => {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve()
    }, s * 1000)
  })
}

class Spider {
  constructor(url) {
    this.url = url
    this.provinces = []
  }

  fetchData() {
    // console.log('Starting fetch provinces...')
    return new Promise(async (resolve, reject) => {
      const response = await axios.get(this.url, options)
      const html = response.data
      const $ = cheerio.load(html)
      const provincesElement = $('.schoolSelect dl:first-of-type span:not(.all) a')
      const provinces = provincesElement.map((index, element) => {
        return {
          name: $(element).text(),
          link: $(element).attr('href')
        }
      }).get();
      resolve(provinces)
    })
  }

  async start() {
    try {
      this.provinces = await this.fetchData()
      this.provinces.forEach(async (result, index) => {
        sleep(1)
        const schoolSpider = new SchoolSpider(result.link, result.name)
        const schools = await schoolSpider.start()
        console.log(`${result.name}:${schools.length}`)
      })
    } catch (err) {
      console.error(err);
    }
  }
}

class SchoolSpider extends Spider {
  constructor(url, province) {
    super()
    this.url = url
    this.province = province
    this.schools = []
  }
  fetchData() {
    // console.log(`Starting fetch schools of ${this.province}...`)
    return new Promise(async (resolve, reject) => {
      const response = await axios.get(this.url, options)
      sleep(3)
      const html = response.data
      const $ = cheerio.load(html)
      const pages = $('.schoolFilter .pm .t').text().split('/')[1]
      for(let i = 1; i <= pages; i++) {
        sleep(3)
        const schoolsInPage = await this.fetchDataByPage(i)
        this.schools = [...this.schools, ...schoolsInPage]
      }
      resolve(this.schools)
    })
  }
  fetchDataByPage(page) {
    // console.log(`Starting fetch schools of page ${page} in ${this.province}...`)
    return new Promise(async (resolve, reject) => {
      const realLink = `${this.url.slice(0, -5)}--p-${page}.html`
      const response = await axios.get(realLink, options)
      const html = response.data
      const $ = cheerio.load(html)
      const schoolElements = $('.schoolList .slist h3 a')
      const schools = schoolElements.map((index, element) => {
        return $(element).text()
      }).get()
      debugger
      resolve(schools)
    })
  }
  start() {
    return new Promise(async (resolve) => {
      this.schools = await this.fetchData()
      resolve(this.schools)
    })
  }
}

const spider = new Spider(baseUrl)
spider.start()

// const schoolSpider = new SchoolSpider('http://www.gaokaopai.com/daxue-54-0-0-0-0-0-0--p-1.html', '西藏')
// schoolSpider.start().then(schools => {
//   console.log(schools.length)
// })
