const jwt = require('jsonwebtoken');

function findByEmail(Model, email) {
  return Model.findOne({ email: String(email || '').trim() }).collation({ locale: 'en', strength: 2 });
}

function passwordProblem(password) {
  if (typeof password !== 'string' || password.length < 8) {
    return 'Password must be at least 8 characters long.';
  }
  if (password.length > 72) {
    return 'Password must be 72 characters or fewer.';
  }
  return null;
}

async function revokeToken(Model, token) {
  if (!token) return;
  try {
    const { _id } = jwt.verify(token, process.env.SECRET_KEY);
    await Model.updateOne({ _id }, { $pull: { tokens: { token } } });
  } catch (err) {
  }
}

module.exports = { findByEmail, passwordProblem, revokeToken };
