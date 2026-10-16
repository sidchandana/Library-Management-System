const jwt = require('jsonwebtoken');
const User = require('../model/userSchema');

const secretKey = process.env.SECRET_KEY;
const Authenticate = async (req, res, next) => {
  try {
    const token = req.cookies.jwtoken;
    if (!token) {
      throw new Error('No token provided');
    }

    const verifyToken = jwt.verify(token, secretKey);

    const rootUser = await User.findOne({ _id: verifyToken._id, "tokens.token": token });

    if (!rootUser) {
      throw new Error('User not found');
    }

    req.token = token;
    req.rootUser = rootUser;
    req.userID = rootUser._id;

    next();
  } catch (err) {
    res.status(401).send('Unauthorized: Invalid token');
    console.error('Authentication error:', err.message);
  }
}

module.exports = Authenticate;
