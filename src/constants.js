// 存放用户所需要的常量

// 版本号
const { version } = require('../package.json')

// 存储下载的模板的位置
const downloadDirectory = `${
  process.env[process.platform === 'darwin' ? 'HOME' : 'USERPROFILE']
}\\.template`
// console.log(downloadDirectory) // C:\Users\31462\.template

module.exports = {
  version,
  downloadDirectory,
}
