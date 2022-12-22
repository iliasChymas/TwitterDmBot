import Twit from "twit"
import { config } from './config.js'
import { parse } from 'csv-parse/sync'
import fs from "fs"

const T = Twit(config);

const ImageUpload = (imagePath) => {
  let b64content = fs.readFileSync(imagePath, { encoding: 'base64' })
  return new Promise((resolve, reject) => {
    T.post('media/upload', { media_data: b64content }, function(err, data, _response) {
      if (err) reject(err)
      resolve(data.media_id_string)
    })
  })
}


const timer = ms => new Promise(res => setTimeout(res, ms))

const getUserInfo = (tHandle) => {
  return new Promise((reject, resolve) => {
    T.get("users/show", { screen_name: tHandle }, function(data, err, _response) {
      if (err) {
        reject(err)
      }
      resolve(data)
    })
  })
}

const sendMessage = (text, uid, imageId) => {
  let data = {
    event: {
      type: "message_create", message_create: {
        target: {
          recipient_id: uid,
        },
        message_data: {
          text: text,
        }
      }
    }
  }
  if (imageId !== undefined && imageId !== "") {
    data.event.message_create.message_data.attachment = {
      type: "media",
      media: {
        id: imageId
      }
    }
  }
  return new Promise((reject, resolve) => {
    T.post("direct_messages/events/new", data, function(data, err, _response) {
      if (err) reject(err)
      resolve(data)
    })
  })
}

const csvRaw = fs.readFileSync("messages.csv")
let nextRaw;
try {
  nextRaw = fs.readFileSync("next.txt")
} catch (_err) {
  fs.writeFileSync("next.txt", "")
  nextRaw = fs.readFileSync("next.txt")
}

const records = parse(csvRaw, {
  columns: true,
  delimiter: ','
})

let nextIndex = records.findIndex(item => item.handle === String(nextRaw).trim())

if (nextIndex === -1) {
  nextIndex = 0
}

for (let i = nextIndex; i < records.length; i++) {

  if (i - nextIndex >= 450) {
    fs.writeFileSync('next.txt', records[i], { encoding: 'utf8', flag: 'w' })
  }

  let user = await getUserInfo(records[i].handle)

  try {
    imageId = ImageUpload(records[i].image)
  } catch (_err) {
    if (records[i].image !== "") {
      console.log("Could not find " + records[i].image)
    }
  }
  await sendMessage(records[i].message, user.id, records[i].image)
  console.log("[Info] Send message to: " + records[i].handle)
  await timer(120000)
}
