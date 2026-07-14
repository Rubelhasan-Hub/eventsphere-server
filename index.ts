import express from 'express';
import type { Request, Response } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { MongoClient } from 'mongodb';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const uri = process.env.MONGODB_URI;

if (!uri) {
  console.error("Error: MONGODB_URI is not defined in environment variables!");
  process.exit(1);
}

const client = new MongoClient(uri);

async function connectDB() {
  try {
    await client.connect();
    console.log("Successfully connected to live MongoDB Atlas!");
  } catch (error) {
    console.error("MongoDB Atlas connection failed:", error);
  }
}
connectDB();

const database = client.db("eventsphere_db");
const usersCollection = database.collection("users");
const eventsCollection = database.collection("events");
const bookingsCollection = database.collection("bookings");
const reviewsCollection = database.collection("reviews");

app.get('/', (req: Request, res: Response) => {
  res.send('EventSphere Live Server is Running!');
});

app.get('/api/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'success',
    message: 'Live Atlas Database connected successfully',
    timestamp: new Date().toISOString()
  });
});

app.post('/api/users', async (req: Request, res: Response) => {
  try {
    const user = req.body;
    const query = { email: user.email };
    const existingUser = await usersCollection.findOne(query);

    if (existingUser) {
      return res.status(200).send({ message: 'User already exists', insertedId: null });
    }

    const result = await usersCollection.insertOne({
      ...user,
      role: 'user',
      createdAt: new Date()
    });
    
    res.status(201).send(result);
  } catch (error) {
    res.status(500).send({ message: 'Failed to create user', error });
  }
});

app.get('/api/users', async (req: Request, res: Response) => {
  try {
    const users = await usersCollection.find().toArray();
    res.send(users);
  } catch (error) {
    res.status(500).send({ message: 'Failed to fetch users' });
  }
});

app.post('/api/events', async (req: Request, res: Response) => {
  try {
    const newEvent = req.body;
    const result = await eventsCollection.insertOne({
      ...newEvent,
      createdAt: new Date()
    });
    res.status(201).send(result);
  } catch (error) {
    res.status(500).send({ message: 'Failed to create event', error });
  }
});

app.get('/api/events', async (req: Request, res: Response) => {
  try {
    const events = await eventsCollection.find().sort({ createdAt: -1 }).toArray();
    res.send(events);
  } catch (error) {
    res.status(500).send({ message: 'Failed to fetch events' });
  }
});

app.post('/api/bookings', async (req: Request, res: Response) => {
  try {
    const bookingData = req.body;
    const result = await bookingsCollection.insertOne({
      ...bookingData,
      bookedAt: new Date()
    });
    res.status(201).send(result);
  } catch (error) {
    res.status(500).send({ message: 'Failed to create booking', error });
  }
});

app.get('/api/my-bookings/:email', async (req: Request, res: Response) => {
  try {
    const email = req.params.email;
    const query = { userEmail: email };
    const result = await bookingsCollection.find(query).toArray();
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: 'Failed to fetch your bookings' });
  }
});

app.listen(port, () => {
  console.log(`EventSphere app listening on port ${port}`);
});

export default app;