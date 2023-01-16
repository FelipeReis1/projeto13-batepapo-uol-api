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
  try {
    if (!name) {
      return res.sendStatus(422);
    }
    const nameSchema = joi.object({ name: joi.string().min(1).required() });
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

app.get("/participants", async (req, res) => {
  const participants = await db.collection("participants").find().toArray();
  res.status(200).send(participants);
});

app.post("/messages", async (req, res) => {
  const { to, text, type } = req.body;
  const { user } = req.headers;
  try {
    const messageSchema = joi.object({
      to: joi.string().min(1).required(),
      text: joi.string().min(1).required(),
      type: joi.string().valid("message", "private_message").required(),
    });
    const messageValidation = messageSchema.validate({ to, text, type });
    if (!messageValidation) {
      return res.sendStatus(422);
    }
    const userRegistered = await db
      .collection("participants")
      .findOne({ name: user });
    if (!userRegistered) {
      return res.sendStatus(422);
    }

    await db.collection("messages").insertOne({
      from: user,
      to,
      text,
      type,
      time: dayjs(Date.now()).format("HH:mm:ss"),
    });
    return res.sendStatus(201);
  } catch {
    return res.sendStatus(422);
  }
});

app.get("/messages", async (req, res) => {
  const { user } = req.headers;
  let limit;
  let reversedMessages;
  try {
    const messages = await db
      .collection("messages")
      .find({ $or: [{ from: user }, { to: user }, { to: "Todos" }] })
      .toArray();
    if (req.query.limit) {
      limit = Number(req.query.limit);
      if (limit < 1 || isNaN(limit)) {
        return res.sendStatus(422);
      } else {
        reversedMessages = messages.slice(-limit).reverse();
        return res.status(200).send(reversedMessages);
      }
    } else {
      limit = Number(req.query.limit);
      reversedMessages = messages.slice(-limit).reverse();
      return res.status(200).send(reversedMessages);
    }
  } catch {
    return res.sendStatus(422);
  }
});

app.post("/status", async (req, res) => {
  const { user } = req.headers;
  try {
    const userRegistered = await db
      .collection("participants")
      .findOne({ name: user });
    if (!userRegistered) {
      return res.sendStatus(404);
    }
    await db
      .collection("participants")
      .updateOne({ name: user }, { $set: { lastStatus: Date.now() } });
    return res.sendStatus(200);
  } catch {
    return res.sendStatus(422);
  }
});

app.listen(PORT, () => console.log(`Server running on port: ${PORT} `));
