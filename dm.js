import Twit from "twit"
import { parse } from 'csv-parse/sync'
import fs from "fs"

let config = JSON.parse(process.argv[2])

const T = Twit({
  consumer_key: config.consumer_key,
  consumer_secret: config.consumer_secret,
  access_token: config.access_token,
  access_token_secret: config.access_token_secret,
  timeout_ms: 60 * 1000,  // optional http request timeout to apply to all requests.
  strictssl: true,     // optional - requires ssl certificates to be valid.
});

const ImageUpload = (imagepath) => {
  let b64content = fs.readFileSync("./images/" + imagepath, { encoding: 'base64' })
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

const sendMessage = (text, uid, imageid) => {
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
  if (imageid !== undefined && imageid !== "") {
    data.event.message_create.message_data.attachment = {
      type: "media",
      media: {
        id: imageid
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

const recordsRaw = fs.readFileSync("csvjson.json")
let nextRaw;
try {
  nextRaw = fs.readFileSync(`next${process.argv[3]}.txt`)
} catch (_err) {
  fs.writeFileSync(`next${process.argv[3]}.txt`, "")
  nextRaw = fs.readFileSync(`next${process.argv[3]}.txt`)
}

let records = JSON.parse(recordsRaw)

let nextIndex = records.findIndex(message => message.Handle === String(nextRaw).trim())
if (nextIndex === -1) nextIndex = 0

records = records.slice(nextIndex)
let recordsToMessage = records.filter(message => message.Account - 1 === Number(process.argv[3]))

for (let i = nextIndex; i < recordsToMessage.length; i++) {
  fs.writeFileSync(`next${process.argv[3]}.txt`, recordsToMessage[i].Handle, { encoding: 'utf8', flag: 'w' })
  let user = await getUserInfo(recordsToMessage[i].Handle)
  let imageId = ""
  try {
    imageId = await ImageUpload(recordsToMessage[i].Image)
  } catch (err) {
    if (recordsToMessage[i].Image !== "") {
      console.log("Could not find " + recordsToMessage[i].Image)
    }
  }
  try {
    await sendMessage(recordsToMessage[i].Message, user.id_str, imageId)
    console.log("[Info] Messaged: ", recordsToMessage[i].Handle)
  } catch (err) {
    console.log("Could not message: " + recordsToMessage[i].Handle)
  }
  await timer(120000)
}
