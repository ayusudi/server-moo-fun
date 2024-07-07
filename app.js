if (!process.env.NODE_ENV || process.env.NODE_ENV === 'development') {
  require('dotenv').config();
}
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const morgan = require('morgan');
const path = require('path');
const {
  COSMOSDB_HOST,
  COSMOSDB_PORT,
  COSMOSDB_DBNAME,
  COSMOSDB_USER,
  COSMOSDB_PASSWORD,
  PORT
} = process.env;

const Controller = require("./Controller.js")
const mongoUri = `mongodb://${COSMOSDB_USER}:${COSMOSDB_PASSWORD}@${COSMOSDB_HOST}:${COSMOSDB_PORT}/${COSMOSDB_DBNAME}?retryWrites=false&ssl=true&replicaSet=globaldb`;

const app = express();

app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/public', express.static(path.join(__dirname, 'public')));
app.get("/", (req, res) => res.send("Server For Moo Fun"))
app.get("/videos", Controller.getAll)
app.post("/prompt", Controller.prompt)
app.post("/check", Controller.check)
app.post('/merge/:id', Controller.merge);
app.get("/analyze/:id", Controller.analyze)
app.post("/gpt/:id", Controller.moofunGPT)


mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 8000 })
  .then(() => {
    console.log('Connection to CosmosDB successful')
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    })
  })
  .catch((err) => console.error('Error connecting to CosmosDB:', err));
