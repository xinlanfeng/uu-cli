// 放置要执行的核心代码

// 1. 解析用户的参数
const program = require('commander')
const path = require('path')

const {
  version
} = require('./constants.js')

// 配置命令
// (1) 声明一个命令的集合
const mapActions = {
  create: {
    alias: 'c',
    description: 'create a project',
    examples: ['uu-cli create <project-name>'],
  },
  config: {
    alias: 'conf',
    description: 'config project variable',
    examples: ['uu-cli config set <k> <v>', 'uu-cli config get <k>'],
  },
  '*': {
    alias: '',
    description: 'command not found',
    examples: [],
  },
}

// (2) 创建命令
Reflect.ownKeys(mapActions).forEach(action => {
  program
    .command(action) // 配置命令的名字
    .alias(mapActions[action].alias) // 命令的别名
    .description(mapActions[action].description) // 命令的描述
    .action(() => {
      if (action === '*') {
        // 找不到对应命令
        console.log(mapActions[action].description)
      } else {
        // 找到了对应命令后，就执行命令
        // 例如：uu-cli create <project-name> 的 project-name是process.argv的第4个参数(后面可能还有参数)
        require(path.resolve(__dirname, action))(...process.argv.splice(3))
      }
    })
})

// (3)监听用户的 --help指令，显示examples
program.on('--help', () => {
  console.log('\nExamples:')
  Reflect.ownKeys(mapActions).forEach(action => {
    mapActions[action].examples.forEach(item => console.log(`  ${item}`))
  })
})

// 解析用户传递过来的参数  --- 一定要放在配置命令的后面
// 用户参数放置在 process.argv 数组中
program.version(version).parse(process.argv)
