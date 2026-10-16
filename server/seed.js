require('dotenv').config();
const mongoose = require('mongoose');
const { connectToDatabase, databaseName } = require('./db/conn');
const Book = require('./model/bookSchema');
const User = require('./model/userSchema');
const Admin = require('./model/adminSchema');

const books = [
  ['Introduction to Algorithms', 'Comprehensive text on algorithms and data structures.', 'Thomas H. Cormen', 'Textbook', 'Computer Science'],
  ['Operating System Concepts', 'Fundamentals of modern operating systems.', 'Abraham Silberschatz', 'Textbook', 'Computer Science'],
  ['Computer Networks', 'Principles of computer networking.', 'Andrew S. Tanenbaum', 'Textbook', 'Computer Science'],
  ['Microelectronic Circuits', 'Analog and digital circuit design.', 'Adel S. Sedra', 'Textbook', 'Electrical Engineering'],
  ['Signals and Systems', 'Continuous and discrete-time signals and systems.', 'Alan V. Oppenheim', 'Textbook', 'Electrical Engineering'],
  ['Engineering Thermodynamics', 'Classical thermodynamics for engineers.', 'P. K. Nag', 'Textbook', 'Mechanical Engineering'],
  ['Mechanics of Materials', 'Stress, strain and the behaviour of materials.', 'Ferdinand P. Beer', 'Textbook', 'Mechanical Engineering'],
  ['Structural Analysis', 'Analysis of statically determinate and indeterminate structures.', 'R. C. Hibbeler', 'Textbook', 'Civil Engineering'],
  ['Elements of Chemical Reaction Engineering', 'Reaction kinetics and reactor design.', 'H. Scott Fogler', 'Textbook', 'Chemical Engineering'],
  ['Introduction to Electrodynamics', 'Classical electromagnetism.', 'David J. Griffiths', 'Textbook', 'Engineering Physics'],
  ['Concepts of Modern Physics', 'Relativity, quantum mechanics and atomic physics.', 'Arthur Beiser', 'Textbook', 'Engineering Physics'],
].map(([title, description, author, genre, department], i) => ({
  title, description, author, genre, department,
  count: 5, vendor: 'Sample Vendor', vendor_id: 1000 + i, publisher: 'Sample Publisher', publisher_id: `P${100 + i}`,
}));

(async () => {
  await connectToDatabase();
  console.log(`Connected to "${databaseName}"`);

  // Make sure the three collections exist: Books, Users, Admin.
  await Promise.all([Book.init(), User.init(), Admin.init()]);

  if ((await Book.estimatedDocumentCount()) === 0) {
    await Book.insertMany(books);
    console.log(`Added ${books.length} sample books`);
  } else {
    console.log('Books already present - skipped');
  }

  if (!(await Admin.findOne({ email: 'admin@iitdh.ac.in' }))) {
    await new Admin({ name: 'Library Admin', email: 'admin@iitdh.ac.in', password: 'Admin@123', cpassword: 'Admin@123' }).save();
    console.log('Added admin    admin@iitdh.ac.in / Admin@123');
  }
  if (!(await User.findOne({ email: 'ce23bt007@iitdh.ac.in' }))) {
    await new User({
      name: 'Siddharth Chandana', email: 'ce23bt007@iitdh.ac.in', password: 'Siddharth@123', cpassword: 'Siddharth@123',
      program: 'B.Tech', branch: 'Civil and Infrastructure Engineering',
    }).save();
    console.log('Added ce23bt007  ce23bt007@iitdh.ac.in / Siddharth@123');
  }
  if (!(await User.findOne({ email: 'cs23bt006@iitdh.ac.in' }))) {
    await new User({
      name: 'Nilesh Kumar', email: 'cs23bt006@iitdh.ac.in', password: 'Nilesh@123', cpassword: 'Nilesh@123',
      program: 'B.Tech', branch: 'Computer Science Engineering',
    }).save();
    console.log('Added cs23bt006  cs23bt006@iitdh.ac.in / Nilesh@123');
  }

  console.log('Done. Change these passwords after your first login.');
  await mongoose.disconnect();
})().catch(async (err) => {
  console.error('Seed failed:', err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
