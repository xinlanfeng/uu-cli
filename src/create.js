// create 命令的所有逻辑

const axios = require('axios')
const ora = require('ora')
const Inquirer = require('inquirer')
const {
  downloadDirectory
} = require('./constants')
const {
  promisify
} = require('util')
const path = require('path')
// 遍历文件夹，寻找需要渲染的文件
const MetalSmith = require('metalsmith')
const fs = require('fs')

let downloadGitRepo = require('download-git-repo')
// promisify可以把异步的API转换成promise
downloadGitRepo = promisify(downloadGitRepo)

let ncp = require('ncp')
ncp = promisify(ncp)

// consolidate 统一了所有的模板引擎
let {
  render
} = require('consolidate').ejs
render = promisify(render)

// create 命令用于创建项目
// 拉取你自己的所有项目列出来 让用户选 安装哪个项目
// 选择完毕后，再显示所有的版本号
// github的API: https://developer.github.com/v3/
// 通过github的API获取组织下的仓库: https://api.github.com/orgs/zhu-cli/repos
// 可能还需要用户配置一些数据，来结合渲染我的项目

// (1) 获取项目列表
const fetchRepoList = async () => {
  const {
    data
  } = await axios.get('https://api.github.com/orgs/zhu-cli/repos')
  return data
}

// (2) 获取项目版本号 (tag列表)
const fetchTagList = async repo => {
  const {
    data
  } = await axios.get(
    `https://api.github.com/repos/zhu-cli/${repo}/tags`
  )
  return data
}

// (3) 封装loading效果
const waitFnLoading = (fn, message) => async (...args) => {
  // 在加载完成之前，显示loading; 加载完成后关闭loading
  const spinner = ora(message)
  spinner.start()
  const result = await fn(...args)
  spinner.succeed()

  return result
}

// (4) download方法：将选择的对应版本号的模板下载到本地
const download = async (repo, tag) => {
  let api = `zhu-cli/${repo}`
  if (tag) {
    api += `#${tag}`
  }

  const dest = `${downloadDirectory}\\${repo}`
  await downloadGitRepo(api, dest)

  // 下载的模板的最终存放目录
  return dest
}

module.exports = async projectName => {
  // 1. 获取项目的所有模板
  // 在获取到模板之前，显示loading; 获取到模板后关闭loading
  let repos = await waitFnLoading(fetchRepoList, 'fetching template ......')()
  repos = repos.map(item => item.name)

  // 选择模板 inquirer
  const {
    repo
  } = await Inquirer.prompt({
    //获取选择后的结果
    name: 'repo',
    type: 'list',
    message: 'please choise a template to create project',
    choices: repos,
  })

  // 2. 通过当前选择的模板 拉取对应的版本
  // 获取对应版本号：https://api.github.com/repos/zhu-cli/vue-simple-template/tags
  let tags = await waitFnLoading(fetchTagList, 'fetching tags ......')(repo)
  tags = tags.map(item => item.name)

  // 选择版本 inquirer
  const {
    tag
  } = await Inquirer.prompt({
    name: 'tag',
    type: 'list',
    message: 'please choise a tag to create project',
    choices: tags,
  })

  console.log(repo, tag) // vue-simple-template 4.0

  // 3. 下载模板
  // 将模板放在一个临时目录 downloadDirectory 里存好, 以备后期使用
  // download-git-repo 在git中下载模板
  // result 为下载的模板的存放目录
  let result = await waitFnLoading(download, 'download template ......')(
    repo,
    tag
  )
  // console.log(result) // C:\Users\31462\.template\vue-simple-template

  // 4. 拷贝模板到当前执行命令的目录下
  // 简单的模板只需把下载的模板文件直接拷贝到当前执行命令的目录 path.resolve() 下即可 ncp
  // 安装 ncp 包

  // 复杂的模板需要渲染后再拷贝到当前执行命令的目录下
  // 如果有 ask.js 文件就是一个复杂的模板，需要用户进行选择，选择后进行模板编译
  // 使用 metalsmith 模块, 读取所有文件, 实现模板渲染(只要是模板渲染都需要这个模块)

  // 寻找下载的模板文件看是否包含 ask.js 文件
  if (!fs.existsSync(path.join(result, 'ask.js'))) {
    await ncp(result, path.resolve(projectName)) // 简单模板
  } else {
    // 复杂模板
    // 1) 让用户填信息
    await new Promise((resolve, reject) => {
      MetalSmith(__dirname)
        .source(result) // 遍历下载的模板
        .destination(path.resolve(projectName)) // 拷贝到目标文件下
        .use(async (files, metal, done) => {
          // 获取ask.js文件
          const args = require(path.join(result, 'ask.js'))
          // 用户根据ask.js文件输入信息，res存放用户输入的结果
          const res = await Inquirer.prompt(args)
          const meta = metal.metadata()
          Object.assign(meta, res)
          delete files['ask.js']
          done()
        })
        .use((files, metal, done) => {
          // 通过metal.metadata()获取到用户输入的结果
          const data = metal.metadata()

          Reflect.ownKeys(files).forEach(async file => {
            // .js和.json文件是需要进行处理的文件
            if (file.includes('js') || file.includes('json')) {
              let content = files[file].contents.toString() // 文件的内容
              // 如果内容是.ejs模板，就需要进行替换渲染
              if (content.includes('<%')) {
                content = await render(content, data) // 渲染后新的文件内容
                // 把原来的内容替换为渲染后的新的文件内容，输出到destination目标文件中
                // Buffer.from(): 把不是buffer格式的数据(content是字符串)转换成Buffer格式的数据
                files[file].contents = Buffer.from(content)
              }
            }
          })
          done()
        })
        .build(err => {
          if (err) {
            reject()
          } else {
            resolve()
          }
        })
    })

    // 2) 用用户填写的信息去渲染模板
  }
}
