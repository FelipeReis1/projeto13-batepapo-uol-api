import cors from "cors";
import express, { json } from "express";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import joi from "joi";
import dayjs from "dayjs";

const PORT = 5000;
const app = express();
dotenv.config();
app.use(cors());
app.use(json());

const mongoClient = new MongoClient(process.env.DATABASE_URL);
const db = mongoClient.db();

try {
  await mongoClient.connect();
  console.log("Conexão funcionou corretamente!");
} catch (err) {
  console.log(err.message);
}

app.post("/participants", async (req, res) => {
  const { name } = req.body;

  if (!name) {
    return res.sendStatus(422);
  }
  const nameSchema = joi.object({ name: joi.string().required() });
  const nameValidation = nameSchema.validate({ name });
  if (nameValidation.error) {
    const errors = nameValidation.details.map((d) => d.message);
    return res.status(422).send(errors);
  }
  const nameAlreadyRegistered = await db
    .collection("participants")
    .findOne({ name: name });
  if (nameAlreadyRegistered) {
    return res.sendStatus(409);
  }
  try {
    await db
      .collection("participants")
      .insertOne({ name, lastStatus: Date.now() });
    await db.collection("messages").insertOne({
      from: name,
      to: "Todos",
      text: "entra na sala...",
      type: "status",
      time: dayjs(Date.now()).format("HH:mm:ss"),
    });
    return res.sendStatus(201);
  } catch {
    return res.sendStatus(422);
  }
});

app.listen(PORT, () => console.log(`Server running on port: ${PORT} `));
