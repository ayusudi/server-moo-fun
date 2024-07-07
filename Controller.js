const axios = require("axios")
const crypto = require('crypto');
const https = require('https');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const { v2: cloudinary } = require('cloudinary');
const path = require('path');


const VideoMooFun = require("./models/VideoMooFun.js")

const firstPrompt = require("./helpers/firstPrompt.js")
const promptMooFun = require("./helpers/promptMooFun.js")
const computerVision = require('./helpers/computerVision.js');
const chatGPTAzureOpenAI = require("./helpers/chatGPTAzureOpenAI.js")

const {
  CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET,
  URL_HAIPER1,
  URL_HAIPER2,
  KEY1_HAIPER,
  VALUE1_HAIPER,
  KEY2_HAIPER,
  VALUE2_HAIPER } = process.env
const headers = {}
headers[KEY1_HAIPER] = VALUE1_HAIPER
headers[KEY2_HAIPER] = VALUE2_HAIPER
headers['Content-Type'] = 'application/json'

const outputDir = path.join(__dirname, 'frames');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir);
}

cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET
});

ffmpeg.setFfmpegPath(ffmpegPath);

const downloadVideo = (url, outputPath) => {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outputPath);
    https.get(url, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close(resolve);
      });
    }).on('error', (err) => {
      fs.unlink(outputPath, () => reject(err));
    });
  });
};

class Controller {
  static requestVideo(prompt) {
    return axios.request({
      method: 'POST',
      timeout: 12000,
      url: URL_HAIPER1,
      headers,
      data: {
        prompt,
        config: {},
        duration: 4,
        seed: 0,
        is_public: true,
        aspect_ratio: '9:16'
      }
    });
  }
  static async prompt(req, res) {
    try {
      let { text, mood } = req.body
      let data = await firstPrompt(mood, text)
      let temp = []
      console.log(data);
      data.scenes.forEach(el => {
        temp.push(Controller.requestVideo(el))
      })
      Promise.all(temp)
        .then(async (dataVideo) => {
          let videos = dataVideo.map((el, i) => {
            let jsonraw = el.data
            let obj = { ...jsonraw, text: data.scenes[i] }
            return obj
          })
          let video = await VideoMooFun.create({
            mood,
            prompt: text,
            gptChats: [
              { role: "user", content: text, type: "text" },
              { role: "assistant", content: data.content, type: "markdown" }
            ],
            scenes: data.scenes,
          })
          res.status(201).json({ gpt: data, video, haiperai: videos })
        })
        .catch(err => {
          console.log(error);
          throw err
        })
    } catch (error) {
      console.log(error);
      res.status(500).json({ error })
    }
  }
  static async checkId(data) {
    try {
      try {
        const response = await axios.request({
          method: 'POST',
          url: URL_HAIPER2,
          headers,
          data
        });
        return response.data.value
      } catch (error) {
        throw error
      }
    } catch (error) {
      throw error
    }
  }
  static async check(req, res) {
    try {
      let { haiperai } = req.body
      let data = haiperai.map(el => el.value)
      let promises = []
      setTimeout(() => {
        data.forEach(el => promises.push(Controller.checkId(el)))
        Promise.all(promises)
          .then(dataVideos => {
            res.status(200).json({ haiperai: dataVideos })
          })
          .catch(err => {
            throw err
          })
      }, 120000)
    } catch (error) {
      res.status(500).json({ error })
    }
  }
  static async mergeVideos(videoUrls) {
    const downloadedFiles = [];
    try {
      for (const [index, url] of videoUrls.entries()) {
        const filePath = path.resolve(__dirname, `public/video${index + 1}.mp4`);
        await downloadVideo(url, filePath);
        downloadedFiles.push(filePath);
      }
      const uniqueId = crypto.randomBytes(16).toString('hex');
      const outputFilePath = path.resolve(__dirname, 'public', `${uniqueId}.mp4`);
      return new Promise((resolve, reject) => {
        const ffmpegCommand = ffmpeg();
        downloadedFiles.forEach(file => {
          ffmpegCommand.input(file);
        });
        return ffmpegCommand
          .on('start', (commandLine) => {
            console.log('FFmpeg command:', commandLine);
          })
          .on('end', () => {
            downloadedFiles.forEach(file => fs.unlinkSync(file));
            resolve(outputFilePath);
          })
          .on('error', (err) => {
            console.error('Error merging videos:', err);
            reject(err);
          })
          .mergeToFile(outputFilePath, path.join(__dirname, 'tmp'));
      });
    } catch (err) {
      downloadedFiles.forEach(file => fs.unlinkSync(file));
      throw err;
    }
  }
  static async merge(req, res) {
    const videoUrls = req.body.haiperai.map(el => el.video_url)
    try {
      const outputFilePath = await Controller.mergeVideos(videoUrls);
      cloudinary.uploader.upload(outputFilePath, { resource_type: "video", folder: "moofun" }, async (error, result) => {
        if (error) {
          console.error('Error uploading to Cloudinary:', error);
          return res.status(500).send('Error uploading to Cloudinary.');
        }
        fs.unlink(outputFilePath, (unlinkErr) => {
          if (unlinkErr) {
            console.error('Error deleting temporary file:', unlinkErr);
          }
        });
        let { public_id, secure_url } = result
        let videoMooFun = await VideoMooFun.findById(req.params.id)
        videoMooFun.url = secure_url
        videoMooFun.cloudinaryId = public_id
        await videoMooFun.save()
        res.json({ url: secure_url, cloudinaryId: public_id, video: videoMooFun });
      });
    } catch (err) {
      res.status(500).send('Error merging videos.');
    }
  }
  static async extractFrames(videoPath, video_id) {
    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .on('end', () => {
          console.log('Frame extraction completed');
          resolve();
        })
        .on('error', (err) => {
          console.error('Error during frame extraction:', err);
          reject(err);
        })
        .output(`${outputDir}/${video_id}-frame-%03d.png`)
        .outputOptions([
          '-vf', 'fps=1/3'
        ])
        .run();
    });
  }
  static async uploadFramesToCloudinary() {
    const frames = fs.readdirSync(outputDir).map(file => path.join(outputDir, file));
    const uploadedResults = [];
    for (const frame of frames) {
      try {
        const result = await cloudinary.uploader.upload(frame, {
          folder: 'extracted_frames', // optional: folder in Cloudinary where frames will be stored
          public_id: path.basename(frame, path.extname(frame)) // optional: use the base filename as public_id
        });
        fs.unlinkSync(frame);
        uploadedResults.push(result);
      } catch (error) {
        throw error
      }
    }
    return uploadedResults;
  }
  static async downloadVideo(url, outputPath) {
    const writer = fs.createWriteStream(outputPath);
    const response = await axios({
      url,
      method: 'GET',
      responseType: 'stream'
    });
    response.data.pipe(writer);
    return new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    })
  }
  static async analyze(req, res) {
    try {
      let data = await VideoMooFun.findById(req.params.id)
      let url = data.url
      const videoFilePath = path.join(__dirname, 'video.mp4');
      console.log(videoFilePath);
      await Controller.downloadVideo(url, videoFilePath);
      let cloudinaryId = data.cloudinaryId.split("/")[1]
      await Controller.extractFrames(videoFilePath, cloudinaryId);
      const uploadedFrames = await Controller.uploadFramesToCloudinary();
      fs.unlinkSync(videoFilePath)
      let promises = []
      uploadedFrames.forEach((el, i) => promises.push(computerVision({ url: el.url }, { img_url: el.url, id: i + 1 })))
      const frames = await Promise.all(promises)
      data.frames = frames
      data.save()
      res.status(200).json({ video: data })
    } catch (error) {
      res.status(500).json({ error })
    }
  }
  static async moofunGPT(req, res) {
    const { id } = req.params;
    const { content } = req.body
    try {
      const video = await VideoMooFun.findById(id);
      if (!video) {
        return res.status(404).json({ error: 'Video not found' });
      }
      if (video.gptChats.length == 2) {
        let { content, role } = await promptMooFun(video.url, video.frames)
        let gptChats = video.gptChats
        gptChats.push({ role: "user", content: "Analyze the video", type: 'input-text' })
        gptChats.push({ role, content, type: 'markdown' })
        video.gptChats = gptChats
        await video.save()
        return res.status(200).json({ video })
      }
      let array = video.gptChats.map(el => {
        return {
          role: el.role,
          content: el.content
        }
      })
      array = [array[0], array[1], array[array.length - 1]]
      array.push({ role: 'user', content })
      let response = await chatGPTAzureOpenAI(array)
      let userInput = { role: 'user', content, type: 'input-text' }
      let gptOuput = { role: 'assistant', content: response.content, type: 'markdown' }
      video.gptChats.push(userInput, gptOuput)
      await video.save()
      return res.status(200).json({ video })
    } catch (error) {
      res.status(500).json({ error })
    }
  }
  static getAll(req, res) {
    VideoMooFun.find({}, {
      gptChats: 0, frames: 0, scenes: 0, cloudinaryId: 0
    })
      .then(videos => {
        res.status(200).json({ videos })
      })
      .catch(error => res.status(500).json({ error }))
  }
}

module.exports = Controller