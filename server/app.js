
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const upload = require("./middleware/bookImageUpload");
require('dotenv').config(); 
const app = express();

const api = express.Router();

const { connectToDatabase } = require('./db/conn');
const AuthenticateAdmin = require("./middleware/authenticateAdmin");
const User = require('./model/userSchema');
const Book = require("./model/bookSchema");
const { findByEmail } = require('./utils/accounts');

async function migrateLegacyContributions() {
  const collectionNames = (await mongoose.connection.db.listCollections({}, { nameOnly: true }).toArray())
    .map((collection) => collection.name)
    .filter((name) => name.toLowerCase() === 'contributions');
  for (const collectionName of collectionNames) {
    const legacyContributions = await mongoose.connection.db.collection(collectionName).find({}).toArray();
    for (const contribution of legacyContributions) {
      if (!(await Book.exists({ _id: contribution._id }))) {
        const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const title = String(contribution.title || '').trim();
        const author = String(contribution.author || '').trim();
        const existingBook = title && author
          ? await Book.findOne({
              title: new RegExp(`^${escapeRegex(title)}$`, 'i'),
              author: new RegExp(`^${escapeRegex(author)}$`, 'i'),
              $or: [{ status: { $ne: 'pending' } }, { status: 'pending' }],
            })
          : null;
        if (existingBook) {
          existingBook.contributionRequests.push({
            contributor: contribution.contributor,
            count: contribution.count || 1,
            description: contribution.description || '',
            department: contribution.department || '',
            image_url: contribution.image_url,
            submittedAt: contribution.submittedAt || new Date(),
          });
          await existingBook.save();
          continue;
        }
        await Book.create({
          _id: contribution._id,
          title: contribution.title,
          description: contribution.description,
          author: contribution.author,
          genre: contribution.genre,
          department: contribution.department,
          count: contribution.count || 1,
          image_url: contribution.image_url,
          contributor: contribution.contributor,
          submittedAt: contribution.submittedAt || new Date(),
          status: "pending",
        });
      }
    }
    await mongoose.connection.db.dropCollection(collectionName);
    console.log(`Moved ${legacyContributions.length} legacy contribution(s) into Books and removed ${collectionName}.`);
  }
}

app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'Referrer-Policy': 'same-origin',
  });
  next();
});

app.use(express.json());
app.use(cookieParser());


const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  ...(process.env.CLIENT_ORIGIN || '').split(',').map((o) => o.trim().replace(/\/+$/, '')).filter(Boolean),
];
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(null, false);
  },
  credentials: true, // allow the login cookie
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));
app.use("/uploads", express.static(path.resolve(__dirname, "uploads")));


api.get("/health", (req, res) => {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  const database = states[mongoose.connection.readyState] || 'unknown';
  res.status(database === 'connected' ? 200 : 503).json({ status: database === 'connected' ? 'ok' : 'degraded', database });
});
//get all books
api.get("/books", async (req, res) => {
    try {
      const books = await Book.find({ status: { $ne: "pending" } });
      res.json(books);
    } catch (err) {
      res.status(500).json({ error: "Unable to load books." });
    }
  });
  //get book
  api.get("/books/:id", async (req, res) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(404).send("Book not found");
      }
      const book = await Book.findOne({ _id: req.params.id, status: { $ne: "pending" } });
      if (!book) {
        return res.status(404).send("Book not found");
      }
      res.json(book);
    } catch (err) {
      res.status(500).json({ error: "Unable to load books." });
    }
  });
  //get books by department
  api.get("/booksdep/:department", async (req, res) => {
    try {
      const books = await Book.find({department:req.params.department, status: { $ne: "pending" }});
      if (!books) {
        return res.status(404).send("Book not found");
      }
      res.json(books);
    } catch (err) {
      res.status(500).json({ error: "Unable to load books." });
    }
  });
  //get User
  api.get("/users/:id", AuthenticateAdmin, async (req, res) => {
    try {
      const user = await findByEmail(User, req.params.id)
        .select('name email program branch favourites borrowed_books requested_books previously_borrowed_books return_requests');

      if (!user) {
        return res.status(404).json({ error: "Student not found." });
      }
      res.json(user);
    } catch (err) {
      console.error("Error looking up student:", err);
      res.status(500).json({ error: "Unable to load student account." });
    }
  });
//issue

//delete issue request after 24 hours
const cron = require('node-cron');
 // Adjust the path to your User model

cron.schedule('*/5 * * * *', async () => { // Expire pending borrow requests promptly after 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    try {
        const users = await User.find({ 'requested_books.requestedAt': { $lt: oneDayAgo } });
        for (const user of users) {
            const expiredRequests = user.requested_books.filter(request => request.requestedAt < oneDayAgo);
            user.requested_books = user.requested_books.filter(request => request.requestedAt >= oneDayAgo);
            await user.save();
            await Promise.all(expiredRequests.map(request =>
              Book.updateOne({ _id: request.book }, { $inc: { count: 1 } })
            ));
        }
        console.log('Cleanup job completed successfully');
    } catch (err) {
        console.error('Error in cleanup job:', err);
    }
});


 
//autocomplete search
api.get('/search', async (req, res) => {
  const query = req.query.q;
  try {
    let books = [];
    try {
      // Uses the Atlas Search index named "default" on the Books collection.
      books = await Book.aggregate([
        {
          $search: {
            index: 'default',
            autocomplete: {
              query: query,
              path: 'title',
              fuzzy: {
                maxEdits: 2,
              },
            },
          },
        },
        {
          $match: { status: { $ne: "pending" } },
        },
        {
          $limit: 7,
        },
        {
          $project: {
            title: 1,
            author: 1,
          },
        },
      ]);
    } catch (searchErr) {
      console.warn('Atlas Search unavailable, using plain title match:', searchErr.message);
    }

    // No Atlas Search index yet (fresh database)? Fall back to a simple title match so search still works.
    if (!books.length && query) {
      const escaped = String(query).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      books = await Book.find({ title: { $regex: escaped, $options: 'i' }, status: { $ne: "pending" } }, { title: 1, author: 1 }).limit(7);
    }
    res.json(books);
  } catch (error) {
    console.error('Error performing search:', error);
    res.status(500).send('Internal server error');
  }
});

//

//delete return request after 24hr
cron.schedule('0 0 * * *', async () => { // Runs every day at midnight
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const users = await User.find({ 'return_requests.returnedAt': { $lt: oneDayAgo } });

    for (const user of users) {
      const unapprovedRequests = user.return_requests.filter(request => request.returnedAt < oneDayAgo);
      user.return_requests = user.return_requests.filter(request => request.returnedAt >= oneDayAgo);
      for (const request of unapprovedRequests) {
        if (!user.borrowed_books.some(bookId => bookId.toString() === request.book.toString())) {
          user.borrowed_books.push(request.book);
        }
      }
      await user.save();
    }
  } catch (err) {
    console.error('Error in return-request cleanup job:', err);
  }
});
  
//add book
api.post("/books", AuthenticateAdmin, upload.single("image"), async (req, res) => {
    const { title,
      description,
      author,
      genre,
      department,
      count,
      vendor,
      vendor_id,
      publisher,
      publisher_id, } = req.body;
  
    try {
      if (!title || !author || !department || !Number.isFinite(Number(count)) || Number(count) < 0) {
        return res.status(400).json({ error: "Title, author, department, and a valid copy count are required." });
      }
      const book = new Book({ title,
          description,
          author,
          genre,
          department,
          count: Number(count),
          vendor,
          vendor_id,
          publisher,
          publisher_id,
          image_url: req.file ? `/uploads/${req.file.filename}` : undefined });
      await book.save();
      res.status(201).json({ message: "Book added successfully", book });
    } catch (err) {
      console.error("Error adding book:", err);
      res.status(500).json({ error: "An error occurred while adding the book." });
    }
  });

// we link the router files to make our route easy
api.use(require('./router/auth'));
app.use('/api', api);
app.use((err, req, res, next) => {
  if (err instanceof require("multer").MulterError) {
    return res.status(400).json({
      error: err.code === "LIMIT_FILE_SIZE"
        ? "Book cover must be 5 MB or smaller."
        : err.message,
    });
  }
  if (err) {
    console.error("Request error:", err.message);
    return res.status(400).json({ error: err.message || "Invalid request." });
  }
  next();
});
const PORT = process.env.PORT || 4000;

const buildDirectory = path.resolve(__dirname, "../build");
app.use('/api', (req, res) => res.status(404).json({ error: "Not found." }));
if (fs.existsSync(path.join(buildDirectory, "index.html"))) {
  app.use(express.static(buildDirectory));
  app.get(/^\/(?!api\/|uploads\/).*/, (req, res) => {
    res.sendFile(path.join(buildDirectory, "index.html"));
  });
}

// Connect to MongoDB first, then start listening.
connectToDatabase()
  .then(() => {
    console.log('Connected to MongoDB');
    return migrateLegacyContributions();
  })
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server is running at http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('\nMongoDB connection failed:\n  ' + err.message + '\n');
    process.exit(1);
  });
