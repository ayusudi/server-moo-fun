const axios = require('axios');

async function requestVideo(prompt) {
  const options = {
    method: 'POST',
    timeout: 12000,
    url: 'https://haiper-ai-api-unofficial.p.rapidapi.com/v1/haiper/generate',
    headers: {
      'x-rapidapi-key': '6a8ab8e944msh333e3c5012e7414p16dfe1jsn6ed701a8c0e3',
      'x-rapidapi-host': 'haiper-ai-api-unofficial.p.rapidapi.com',
      'Content-Type': 'application/json'
    },
    data: {
      prompt,
      config: {},
      duration: 4,
      seed: 0,
      is_public: true,
      aspect_ratio: '9:16'
    }
  };

  try {
    const response = await axios.request(options);
    return response.data
  } catch (error) {
    console.error(error,);
  }
}

module.exports = requestVideo