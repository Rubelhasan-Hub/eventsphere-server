import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { MongoClient, ObjectId } from 'mongodb';


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


const verifyToken = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.split(' ')[1];

  if (!token) {
    return res.status(401).send({ message: "Unauthorized: No token" });
  }

  try {
    next(); 
  } catch (error) {
    return res.status(403).send({ message: "Invalid or expired token" });
  }
};









connectDB();

const database = client.db("eventsphere_db");
const usersCollection = database.collection("users");
const eventsCollection = database.collection("events");
const bookingsCollection = database.collection("bookings");

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

app.get('/api/events',verifyToken,async (req: Request, res: Response) => {
  try {
    // প্যাগিনেশন এবং ফিল্টার প্যারামিটার রিসিভ করা
    const page = parseInt(req.query.page as string) || 1;
    const limit = 6;
    const skip = (page - 1) * limit;
    const category = req.query.category as string;
    const search = req.query.search as string;

    // JWT/Auth চেক (Authorization হেডার থেকে)
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).send({ message: 'Unauthorized: No token provided' });
    }

    // ফিল্টারিং লজিক
    let query: any = { status: "approved" };
    if (category && category !== 'all') query.category = category;
    if (search) query.title = { $regex: search, $options: 'i' };

    // ডাটাবেজ অপারেশন
    const totalEvents = await eventsCollection.countDocuments(query);
    const events = await eventsCollection
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    res.send({
      events,
      totalEvents,
      totalPages: Math.ceil(totalEvents / limit),
      currentPage: page
    });
  } catch (error) {
    res.status(500).send({ message: 'Failed to fetch events' });
  }
});

app.delete('/api/events/:id', async (req, res) => {
  const id = req.params.id;
  const result = await eventsCollection.deleteOne({ _id: new ObjectId(id) });
  res.send(result);
});

app.patch('/api/events/approve/:id', async (req, res) => {
  const id = req.params.id;
  const filter = { _id: new ObjectId(id) };
  const updateDoc = { $set: { status: 'approved' } };
  const result = await eventsCollection.updateOne(filter, updateDoc);
  res.send(result);
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