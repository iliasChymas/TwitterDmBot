import { config } from './config.js'
import { fork } from 'child_process'

const timer = ms => new Promise(res => setTimeout(res, ms))

for (let i = 0; i < config.length; i++) {
  fork("dm.js", [JSON.stringify(config[i]), i])
  timer(1000)
}
