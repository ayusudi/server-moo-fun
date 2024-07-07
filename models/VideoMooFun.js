const mongoose = require('mongoose');

const videosSchema = new mongoose.Schema({
  cloudinaryId: {
    type: String
  },
  prompt: {
    type: String
  },
  mood: {
    type: String
  },
  scenes: [
    {
      type: String
    }
  ],
  gptChats: [
    {
      role: {
        type: String
      },
      content: {
        type: String
      },
      type: {
        type: String
      }
    }
  ],
  url: {
    type: String,
  },
  cover: {
    type: String
  },
  frames: [
    {
      img_url: {
        type: String
      },
      id: {
        type: String
      },
      text: {
        type: String
      }
    }
  ]
}, {
  timestamps: true,
  versionKey: false
});

const VideoMooFun = mongoose.model('VideoMooFun', videosSchema);

module.exports = VideoMooFun;