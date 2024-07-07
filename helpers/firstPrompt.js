const { AzureOpenAI } = require("openai");

const endpoint = process.env.AZUREOPENAI_ENDPOINT
const apiKey = process.env.AZUREOPENAI_APIKEY
const apiVersion = "2024-02-15-preview";
const deployment = "gpt-4";

async function main(mood, text) {
  try {
    const client = new AzureOpenAI({ endpoint, apiKey, apiVersion, deployment });
    const result = await client.chat.completions.create({
      messages: [
        {
          "role": "system",
          "content": 'You are MOO FUN, an AI created for video generation and analysis to aid content creators. Your role includes translating user input text into English and generating a three-part, four-second textual description of a video scene based on the selected mood, each part is separated and starts with "SCENE" in te with each sentence has structure Subject, Verb and Object (S-V-O).'
        },
        {
          role: "user", content: `My selected is ${mood} and I want to create input like this text: ${text}. Process it!`
        }
      ],
      model: "gpt-4",
    });
    let resultText = result.choices[0].message
    let output = resultText.content.split("SCENE").slice(1).map(el => {
      let str = el.split(":")[1]?.trim()
      return str
    })
    output = output.filter(el => el.length > 2)
    let resultOupt = { ...resultText, scenes: output }
    return resultOupt
  } catch (error) {
    throw error
  }
}

module.exports = main