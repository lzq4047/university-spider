const util = require('util');
const fs = require('fs');
const axios = require('axios')
const cheerio = require('cheerio');
const mysql = require('mysql')
const DBConfig = {
  host: 'localhost',
  user: 'root',
  password: 'root',
  database: 'she'
}
const connection = mysql.createConnection(DBConfig)
connection.connect(err => {
  if(err) {
    console.error(err);
    return
  }
  console.log(`connected as id ${connection.threadId}`);
})

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
    console.log('Starting fetch provinces...')
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
  async saveInFile(content) {
    await fs.appendFile('schools.txt', content)
  }
  async start() {
    let schools = {}
    this.provinces = await this.fetchData()
    await sleep(1)
    this.provinces.forEach(async (item, index) => {
      await sleep(1)
      const codePattern = /daxue-(\d+)/
      const province = {
        name: item.name,
        code: +codePattern.exec(item.link)[1]
      }
      const schoolSpider = new SchoolSpider(item.link, province)
      const schoolsInProvinces = await schoolSpider.start()
      schools[province.name] = schoolsInProvinces
      // this.saveInFile(`${province.name}: ${schoolsInProvinces.join(', ')}\r\n`)
    })
    // connection.end()
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
    console.log(`Starting fetch schools of ${this.province.name}...`)
    return new Promise(async (resolve, reject) => {
      const response = await axios.get(this.url, options)
      await sleep(1)
      const html = response.data
      const $ = cheerio.load(html)
      const pages = $('.schoolFilter .pm .t').text().split('/')[1]
      for(let i = 1; i <= +pages; i++) {
        await sleep(1)
        const schoolsInPage = await this.fetchDataByPage(i)
        this.schools = [...this.schools, ...schoolsInPage]
      }
      resolve(this.schools)
    })
  }
  fetchDataByPage(page) {
    console.log(`Starting fetch schools of page ${page} in ${this.province.name}...`)
    return new Promise(async (resolve, reject) => {
      const realLink = `${this.url.slice(0, -5)}--p-${page}.html`
      const response = await axios.get(realLink, options)
      const html = response.data
      const $ = cheerio.load(html)
      const schoolElements = $('.schoolList .slist h3 a')
      const schools = schoolElements.map((index, element) => {
        return $(element).text()
      }).get()
      schools.forEach(item => {
        connection.query(`INSERT INTO schools(name, province_code, province_name) VALUES("${item}", ${this.province.code}, "${this.province.name}")`, (err, results, fields) => {
          if(err) {
            console.error(err);
            return
          }
        })
      })
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
