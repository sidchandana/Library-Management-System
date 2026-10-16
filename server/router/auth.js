const jwt = require('jsonwebtoken');
const express = require('express');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const Authenticate = require('../middleware/authenticate');
const nodemailer = require('nodemailer');

const router = express.Router();

const User = require('../model/userSchema');
const Book = require('../model/bookSchema');
const Admin = require('../model/adminSchema');
const AuthenticateAdmin = require('../middleware/authenticateAdmin.js');
const upload = require('../middleware/bookImageUpload');
const { authCookieOptions, clearCookieOptions, STUDENT_COOKIE, ADMIN_COOKIE } = require('../utils/cookie');
const { findByEmail, passwordProblem, revokeToken } = require('../utils/accounts');
const rateLimit = require('../utils/rateLimit');


const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 15,
    message: 'Too many sign-in attempts. Please wait a few minutes and try again.',
    key: (req) => `${req.ip}:${String((req.body && req.body.email) || '').trim().toLowerCase()}`,
});
const fs = require('fs');
const path = require('path');


const adminRegistrationGuard = async (req, res, next) => {
    try {
        if (process.env.ALLOW_ADMIN_REGISTRATION === 'true' || !(await Admin.exists({}))) {
            return next();
        }
    } catch (err) {
        console.error("Could not check existing admins:", err);
        return res.status(500).json({ error: "Unable to register admin." });
    }
    return AuthenticateAdmin(req, res, next);
};

router.post('/adminregister', adminRegistrationGuard, async (req, res) => {

    const { name, email, password, cpassword } = req.body;

    if (!name || !email || !password || !cpassword ) {
        return res.status(422).json({ error: "Please filled properly" });
    }

    try {
        const adminExist = await findByEmail(Admin, email);

        if (adminExist) {
            return res.status(422).json({ error: "Email already Exist" });
        }
        else if (password != cpassword) {
            return res.status(422).json({ error: "password is not matching" });
        }
        else if (passwordProblem(password)) {
            return res.status(422).json({ error: passwordProblem(password) });
        }
        else {
            const admin = new Admin({ name, email, password, cpassword });
            await admin.save();
            res.status(201).json({ massage: "user registered successfully" });
        }

    } catch (err) {
        console.error("Admin registration failed:", err);
        return res.status(500).json({ error: "Unable to register admin." });
    }

})


router.post('/admin', AuthenticateAdmin, async (req, res) => {

    const { name, email, password, cpassword, program, branch } = req.body;

    if (!name || !email || !password || !cpassword || !program || !branch) {
        return res.status(422).json({ error: "Please filled properly" });
    }

    try {
        const userExist = await findByEmail(User, email);

        if (userExist) {
            return res.status(422).json({ error: "Email already Exist" });
        }
        else if (password != cpassword) {
            return res.status(422).json({ error: "password is not matching" });
        }
        else if (passwordProblem(password)) {
            return res.status(422).json({ error: passwordProblem(password) });
        }
        else {
            const user = new User({ name, email, password, cpassword, program, branch });
            await user.save();
            res.status(201).json({ massage: "user registered successfully" });
        }

    } catch (err) {
        console.error("Student registration failed:", err);
        return res.status(500).json({ error: "Unable to register student." });
    }

})

// login route

router.post('/loginpage', loginLimiter, async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: "Please fill the data" });
        }

        const userLogin = await findByEmail(User, email);

        if (userLogin) {
            const isMatch = await bcrypt.compare(password, userLogin.password);
            if (!isMatch) {
                return res.status(400).json({ error: "Invalid email or password." });
            }

            await revokeToken(Admin, req.cookies[ADMIN_COOKIE]);
            res.clearCookie(ADMIN_COOKIE, clearCookieOptions());
            const token = await userLogin.generateAuthToken();
            res.cookie(STUDENT_COOKIE, token, authCookieOptions());
            return res.json({
                message: "User login successfully",
                user: {
                    _id: userLogin._id,
                    name: userLogin.name,
                    email: userLogin.email,
                    program: userLogin.program,
                    branch: userLogin.branch,
                },
            });
        }
        return res.status(400).json({ error: "Invalid email or password." });
    } catch (err) {
        console.error("Student login failed:", err);
        return res.status(500).json({ error: "Unable to log in right now." });
    }
})

//admin login
router.post('/loginpageadmin', loginLimiter, async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: "Please fill the data" });
        }

        const adminLogin = await findByEmail(Admin, email);

        if (adminLogin) {
            const isMatch = await bcrypt.compare(password, adminLogin.password);
            if (!isMatch) {
                return res.status(400).json({ error: "Invalid email or password." });
            }

            await revokeToken(User, req.cookies[STUDENT_COOKIE]);
            res.clearCookie(STUDENT_COOKIE, clearCookieOptions());
            const token = await adminLogin.generateAuthToken();
            res.cookie(ADMIN_COOKIE, token, authCookieOptions());
            return res.json({
                message: "Admin login successfully",
                admin: { _id: adminLogin._id, name: adminLogin.name, email: adminLogin.email },
            });
        }
        return res.status(400).json({ error: "Invalid email or password." });
    } catch (err) {
        console.error("Admin login failed:", err);
        return res.status(500).json({ error: "Unable to log in right now." });
    }
})

router.post('/contributions', Authenticate, upload.single('image'), async (req, res) => {
    const { title, author, description, genre, department, count } = req.body;
    const cleanTitle = String(title || '').trim();
    const cleanAuthor = String(author || '').trim();
    if (!cleanTitle || !cleanAuthor) {
        return res.status(400).json({ error: "Book title and author are required." });
    }
    const copies = count === undefined || count === "" ? 1 : Number(count);
    if (!Number.isInteger(copies) || copies < 1) {
        return res.status(400).json({ error: "Copy count must be a positive whole number." });
    }
    const exactPattern = (value) => {
        const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(`^${escaped}$`, 'i');
    };
    const titlePattern = exactPattern(cleanTitle);
    const authorPattern = exactPattern(cleanAuthor);
    const uploadedImage = req.file ? `/uploads/${req.file.filename}` : undefined;
    const request = {
        contributor: req.userID,
        count: copies,
        description: description || '',
        department: department || '',
        image_url: uploadedImage,
        submittedAt: new Date(),
    };

    try {
        let book = await Book.findOne({ title: titlePattern, author: authorPattern, status: { $ne: 'pending' } });
        if (book) {
            book.contributionRequests.push(request);
            await book.save();
            return res.status(201).json({ message: "Thank you! Your contribution is awaiting admin approval.", book });
        }

        book = await Book.findOne({ title: titlePattern, author: authorPattern, status: 'pending' });
        if (book) {
            book.contributionRequests.push(request);
            await book.save();
            return res.status(201).json({ message: "Thank you! Your contribution is awaiting admin approval.", book });
        }

        book = await Book.create({
            title: cleanTitle,
            author: cleanAuthor,
            description: description || '',
            genre: genre || '',
            department: department || '',
            count: copies,
            image_url: uploadedImage,
            contributor: req.userID,
            status: 'pending',
            submittedAt: new Date(),
        });
        return res.status(201).json({ message: "Thank you! Your contribution is awaiting admin approval.", book });
    } catch (err) {
        if (uploadedImage) {
            const imagePath = path.resolve(__dirname, '../uploads', path.basename(uploadedImage));
            await fs.promises.unlink(imagePath).catch(() => {});
        }
        console.error("Book contribution failed:", err);
        return res.status(500).json({ error: "Unable to submit your contribution." });
    }
});

router.get('/admin/contributions', AuthenticateAdmin, async (req, res) => {
    try {
        const books = await Book.find({
            $or: [
                { status: 'pending' },
                { 'contributionRequests.0': { $exists: true } },
            ],
        })
            .populate('contributor', 'name email')
            .populate('contributionRequests.contributor', 'name email')
            .sort({ submittedAt: -1 });
        const contributions = [];
        for (const book of books) {
            if (book.status === 'pending') {
                contributions.push({
                    requestId: book._id.toString(), bookId: book._id.toString(),
                    title: book.title, author: book.author, description: book.description,
                    department: book.department, count: book.count, image_url: book.image_url,
                    contributor: book.contributor, submittedAt: book.submittedAt,
                    existingBook: false, currentCount: 0,
                });
            }
            for (const request of book.contributionRequests || []) {
                contributions.push({
                    requestId: request._id.toString(), bookId: book._id.toString(),
                    title: book.title, author: book.author, description: request.description || book.description,
                    department: request.department || book.department, count: request.count,
                    image_url: request.image_url || book.image_url, contributor: request.contributor,
                    submittedAt: request.submittedAt, existingBook: book.status === 'available',
                    samePendingTitle: book.status === 'pending',
                    currentCount: book.count,
                });
            }
        }
        return res.json({ contributions });
    } catch (err) {
        console.error("Could not load book contributions:", err);
        return res.status(500).json({ error: "Unable to load book contributions." });
    }
});

router.post('/admin/contributions/:requestId/approve', AuthenticateAdmin, async (req, res) => {
    const { bookId } = req.body || {};
    try {
        const newTitle = await Book.findOne({ _id: req.params.requestId, status: 'pending' });
        if (newTitle) {
            newTitle.status = 'available';
            newTitle.vendor = 'Student contribution';
            newTitle.vendor_id = undefined;
            newTitle.publisher = '';
            newTitle.publisher_id = '';
            await newTitle.save();
            return res.json({ message: "Contribution approved and added to the catalogue.", book: newTitle });
        }
        if (!bookId || !mongoose.isValidObjectId(bookId)) {
            return res.status(400).json({ error: "A valid book ID is required for this contribution." });
        }
        const book = await Book.findOne({ _id: bookId, 'contributionRequests._id': req.params.requestId });
        if (!book) return res.status(404).json({ error: "Contribution request not found." });
        const request = book.contributionRequests.id(req.params.requestId);
        const count = request.count;
        const imagePath = request.image_url?.startsWith('/uploads/')
            ? path.resolve(__dirname, '../uploads', path.basename(request.image_url))
            : null;
        const result = await Book.updateOne(
            { _id: bookId, 'contributionRequests._id': req.params.requestId },
            { $inc: { count }, $pull: { contributionRequests: { _id: req.params.requestId } } }
        );
        if (!result.modifiedCount) return res.status(404).json({ error: "Contribution request not found." });
        if (imagePath) await fs.promises.unlink(imagePath).catch((err) => { if (err.code !== 'ENOENT') throw err; });
        const updatedBook = await Book.findById(bookId);
        return res.json({ message: "Contribution approved and copy count updated.", book: updatedBook });
    } catch (err) {
        console.error("Could not approve book contribution:", err);
        return res.status(500).json({ error: "Unable to approve this contribution." });
    }
});

router.delete('/admin/contributions/:requestId', AuthenticateAdmin, async (req, res) => {
    try {
        const newTitle = await Book.findOneAndDelete({
            _id: req.params.requestId,
            status: 'pending',
            $or: [
                { contributionRequests: { $size: 0 } },
                { contributionRequests: { $exists: false } },
            ],
        });
        if (newTitle) {
            if (newTitle.image_url?.startsWith('/uploads/')) {
                const imagePath = path.resolve(__dirname, '../uploads', path.basename(newTitle.image_url));
                await fs.promises.unlink(imagePath).catch((err) => { if (err.code !== 'ENOENT') throw err; });
            }
            return res.json({ message: "Contribution declined." });
        }

        const pendingTitle = await Book.findOne({ _id: req.params.requestId, status: 'pending' });
        if (pendingTitle?.contributionRequests?.length) {
            return res.status(409).json({ error: "Review the additional same-title requests before declining this title." });
        }

        const book = await Book.findOne({ 'contributionRequests._id': req.params.requestId });
        if (!book) return res.status(404).json({ error: "Contribution request not found." });
        const request = book.contributionRequests.id(req.params.requestId);
        const imagePath = request.image_url?.startsWith('/uploads/')
            ? path.resolve(__dirname, '../uploads', path.basename(request.image_url))
            : null;
        book.contributionRequests.pull({ _id: req.params.requestId });
        await book.save();
        if (imagePath) await fs.promises.unlink(imagePath).catch((err) => { if (err.code !== 'ENOENT') throw err; });
        return res.json({ message: "Contribution declined." });
    } catch (err) {
        console.error("Could not decline book contribution:", err);
        return res.status(500).json({ error: "Unable to decline this contribution." });
    }
});

// Issue book route
router.post('/issuebook', Authenticate, async (req, res) => {
    const { id } = req.body;
    console.log("Book ID:", id);
    
    try {
        const book = await Book.findById(id);
        if (!book) {
            return res.status(404).json({ message: 'Book not found' });
        }
        if (!Number.isFinite(book.count) || book.count <= 0) {
            return res.status(400).json({ message: 'No more copies available' });
        }
        
        const user = req.rootUser;
        if (book.status === "pending") {
            return res.status(400).json({ message: 'This book is awaiting library review.' });
        }
        if (
            user.requested_books.some(request => request.book.toString() === book._id.toString()) ||
            user.borrowed_books.some(bookId => bookId.toString() === book._id.toString())
        ) {
            return res.status(400).json({ message: 'You already have this book or have requested it.' });
        }

        // Check the number of books issued in the last 24 hours
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const recentRequests = user.requested_books.filter(request => request.requestedAt > oneDayAgo);

        if (recentRequests.length >= 2) {
            return res.status(400).json({ message: 'You can issue only 2 books in 24 hours' });
        }

        const reservation = await Book.updateOne(
            { _id: book._id, count: { $gt: 0 } },
            { $inc: { count: -1 } }
        );
        if (!reservation.modifiedCount) {
            return res.status(400).json({ message: 'No more copies available' });
        }
        user.requested_books.push({ book: book._id, requestedAt: Date.now() });
        try {
            await user.save();
        } catch (err) {
            await Book.updateOne({ _id: book._id }, { $inc: { count: 1 } });
            throw err;
        }

        res.status(200).json({ message: 'Borrow request submitted. The library admin will review it.' });

       
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error' });
    }
});


router.delete('/cancelbookrequest/:bookId', Authenticate, async (req, res) => {
    try {
        const user = req.rootUser;
        const requestIndex = user.requested_books.findIndex(
            request => request.book && request.book.toString() === req.params.bookId
        );
        if (requestIndex === -1) {
            return res.status(404).json({ message: 'Pending borrow request not found.' });
        }
        const bookId = user.requested_books[requestIndex].book;
        user.requested_books.splice(requestIndex, 1);
        await user.save();
        await Book.updateOne({ _id: bookId }, { $inc: { count: 1 } });
        return res.json({ message: 'Borrow request cancelled.' });
    } catch (err) {
        console.error('Could not cancel borrow request:', err);
        return res.status(500).json({ message: 'Unable to cancel this borrow request.' });
    }
});

router.delete('/removefromfavourite/:id', Authenticate, async (req, res) => {
    try {
        const user = req.rootUser;
        const favouriteIndex = user.favourites.findIndex(
            bookId => bookId.toString() === req.params.id
        );
        if (favouriteIndex === -1) {
            return res.status(404).json({ message: 'Book is not in your favourites.' });
        }
        user.favourites.splice(favouriteIndex, 1);
        await user.save();
        return res.json({ message: 'Book removed from your favourites.' });
    } catch (err) {
        console.error('Could not remove favourite:', err);
        return res.status(500).json({ message: 'Unable to remove this book from your favourites.' });
    }
});

//add to fav
router.post('/addtofavourite', Authenticate, async (req, res) => {
    const { id } = req.body;
    console.log("Book ID:", id);
    
    try {
        const book = await Book.findById(id);
        if (!book) {
            return res.status(404).json({ message: 'Book not found' });
        }

        const user = req.rootUser;
        
        if (user.favourites.some(bookId => bookId.toString() === book._id.toString())) {
            return res.status(409).json({ message: 'This book is already in your favourites.' });
        }
        user.favourites.push(book._id);
        await user.save();

        res.status(200).json({ message: 'Book added to favourites successfully', user });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Approval e-mails are optional: they are only sent when TEMP_PASS (a Gmail app password) is configured.
// Set MAIL_USER to the Gmail address that the app password belongs to.
const mailUser = process.env.MAIL_USER || 'nilesh.kumar.2747@gmail.com';
const transporter = process.env.TEMP_PASS
    ? nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: mailUser,
          pass: process.env.TEMP_PASS,
        },
      })
    : null;

//aproval
router.post('/approvebook', AuthenticateAdmin, async (req, res) => {
    const { userId, bookId } = req.body;

    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const requestIndex = user.requested_books.findIndex(
            request => request.book.toString() === bookId
        );

        if (requestIndex === -1) {
            return res.status(404).json({ message: 'Book request not found' });
        }

        const book = await Book.findOne({ _id: bookId, status: { $ne: "pending" } });
        if (!book) {
            return res.status(404).json({ message: 'Book not found' });
        }

        user.requested_books.splice(requestIndex, 1);
        user.borrowed_books.push(book._id); // Add to issued books
        await user.save();


        const mailOptions = {
            from: mailUser,
            to: user.email,
            subject: 'Book Issue Request Approved',
            text: `Dear ${user.name},\n\nYour request to issue the book "${book.title}" has been approved. You can now pick up the book from the library.\n\nThank you!`
        };

        if (transporter) {
            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    return console.error(error);
                }
                console.log('Email sent: ' + info.response);
            });
        } else {
            console.warn('Approval e-mail not sent: TEMP_PASS is not configured.');
        }
        res.status(200).json({ message: 'Book request approved successfully', user });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

router.post('/rejectbook', AuthenticateAdmin, async (req, res) => {
    const { userId, bookId } = req.body;
    try {
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: 'Student not found.' });
        const requestIndex = user.requested_books.findIndex(
            request => request.book.toString() === bookId
        );
        if (requestIndex === -1) return res.status(404).json({ message: 'Book request not found.' });
        user.requested_books.splice(requestIndex, 1);
        await user.save();
        await Book.updateOne({ _id: bookId }, { $inc: { count: 1 } });
        return res.json({ message: 'Book request declined.' });
    } catch (err) {
        console.error("Could not decline book request:", err);
        return res.status(500).json({ message: 'Unable to decline the book request.' });
    }
});


router.get('/admin/bookrequests', AuthenticateAdmin, async (req, res) => {
    try {
        
        const users = await User.find({ 'requested_books.book': { $exists: true } })
            .select('requested_books name')
            .populate('requested_books.book', 'title');
        const requests = users.flatMap(user =>
            user.requested_books.filter(request => request.book).map(request => ({
                userId: user._id,
                userName: user.name,
                bookId: request.book._id,
                bookTitle: request.book.title,
                requestedAt: request.requestedAt
            }))
        );

        res.status(200).json({ requests });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

//returning book request to admin
router.post('/returnbook', Authenticate, async (req, res) => {
    const { bookId } = req.body;
    
    try {
      const user = req.rootUser;
      
      const borrowedBookIndex = user.borrowed_books.findIndex(b => b.toString() === bookId);
      if (borrowedBookIndex === -1) {
        return res.status(404).json({ message: 'Book not found in borrowed books' });
      }
      if (user.return_requests.some(request => request.book.toString() === bookId)) {
        return res.status(409).json({ message: 'A return request for this book is already pending.' });
      }
  
      const returnRequest = {
        book: bookId,
        returnedAt: new Date()
      };
  
      user.return_requests.push(returnRequest);
      await user.save();
  
      res.status(200).json({ message: 'Return request submitted. The library admin will review it.' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Internal server error' });
    }
  });


router.get('/admin/returnrequests', AuthenticateAdmin, async (req, res) => {
    try {
        
        const users = await User.find({ 'return_requests.book': { $exists: true } })
            .select('return_requests name')
            .populate('return_requests.book', 'title');
        const requests = users.flatMap(user =>
            user.return_requests.filter(request => request.book).map(request => ({
                userId: user._id,
                userName: user.name,
                bookId: request.book._id,
                bookTitle: request.book.title,
                requestedAt: request.returnedAt
            }))
        );

        res.status(200).json({ requests });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error' });
    }
});


router.post('/admin/approvereturn', AuthenticateAdmin, async (req, res) => {
    const { userId, bookId } = req.body;
    
    try {
      const user = await User.findById(userId);
      const book = await Book.findById(bookId);
      
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      if (!book) {
        return res.status(404).json({ message: 'Book not found' });
      }
      
      const returnRequestIndex = user.return_requests.findIndex(r => r.book.toString() === bookId);
      if (returnRequestIndex === -1) {
        return res.status(404).json({ message: 'Return request not found' });
      }
  
      const returnedBook = user.return_requests[returnRequestIndex];
      user.previously_borrowed_books.push(returnedBook);
      user.return_requests.splice(returnRequestIndex, 1);
  
      const borrowedBookIndex = user.borrowed_books.findIndex(b => b.toString() === bookId);
      if (borrowedBookIndex !== -1) {
        user.borrowed_books.splice(borrowedBookIndex, 1);
      }

      book.count++
      await user.save();
      await book.save();
      res.status(200).json({ message: 'Return request approved', user });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Internal server error' });
    }
  });



router.get('/about', Authenticate, (req, res) => {
    const { _id, name, email, program, branch, favourites, borrowed_books, requested_books, previously_borrowed_books, return_requests } = req.rootUser;
    res.json({ _id, name, email, program, branch, favourites, borrowed_books, requested_books, previously_borrowed_books, return_requests });
});
router.get('/aboutadmin', AuthenticateAdmin, (req, res) => {
    const { _id, name, email } = req.rootAdmin;
    res.json({ _id, name, email });
});


router.get('/presentstatuspage', AuthenticateAdmin, (req, res) => {
    res.json({ message: "Admin access verified." });
});

router.get('/logout', async (req, res) => {
    await revokeToken(User, req.cookies[STUDENT_COOKIE]);
    res.clearCookie(STUDENT_COOKIE, clearCookieOptions());
    res.status(200).send("User Logout");
});

router.get('/logoutadmin', async (req, res) => {
    await revokeToken(Admin, req.cookies[ADMIN_COOKIE]);
    res.clearCookie(ADMIN_COOKIE, clearCookieOptions());
    res.status(200).send("Admin Logout");
});


const resetLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: 'Too many password reset attempts. Please wait a few minutes and try again.',
});

router.post('/resetpassword', resetLimiter, async (req, res) => {
    if (process.env.DISABLE_PASSWORD_RESET === 'true') {
        return res.status(403).json({ error: "Password reset is switched off. Please contact the library." });
    }
    const { email, password, cpassword, role } = req.body || {};
    const Model = role === 'admin' ? Admin : role === 'student' ? User : null;
    if (!Model) {
        return res.status(400).json({ error: "Unknown account type." });
    }
    if (!email || !password || !cpassword) {
        return res.status(422).json({ error: "Please fill in all the fields." });
    }
    if (password !== cpassword) {
        return res.status(422).json({ error: "Passwords do not match." });
    }
    const problem = passwordProblem(password);
    if (problem) {
        return res.status(422).json({ error: problem });
    }

    try {
        const account = await findByEmail(Model, email);
        if (!account) {
            return res.status(404).json({ error: "No account was found with this email." });
        }
        account.password = password;
        account.cpassword = cpassword;
        account.tokens = []; 
        await account.save();

        if (transporter) {
            transporter.sendMail({
                from: mailUser,
                to: account.email,
                subject: 'Your IITDh Book Shelf password was changed',
                text: `Dear ${account.name},\n\nThe password of your account was just changed. If this was not you, please contact the library immediately.`,
            }, (error) => {
                if (error) console.error('Could not send password change e-mail:', error.message);
            });
        }
        return res.json({ message: "Password updated. You can now sign in with your new password." });
    } catch (err) {
        console.error("Password reset failed:", err);
        return res.status(500).json({ error: "Unable to reset the password right now." });
    }
});

module.exports = router;
