const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");


const AdminSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
      },
      email: {
        type: String,
        required: true,
      },
      password: {
        type: String,
        required: true,
      },
      cpassword: {
        type: String,
        required: true,
      },
      tokens: [
        {
          token: {
            type: String,
            required: true,
          },
        },
      ]
});

// Never include password hashes or login tokens when an admin is sent as JSON.
AdminSchema.set("toJSON", { transform: (doc, ret) => { delete ret.password; delete ret.cpassword; delete ret.tokens; return ret; } });

AdminSchema.pre("save", async function (next) {
    if (this.isModified("password")) {
      this.password = await bcrypt.hash(this.password, 12);
      this.cpassword = await bcrypt.hash(this.cpassword, 12);
    }
    next();
  });
  
  AdminSchema.methods.generateAuthToken = async function () {
    try {
      let token = jwt.sign({ _id: this._id }, process.env.SECRET_KEY);
      this.tokens = this.tokens.concat({ token: token }).slice(-20); // keep the 20 most recent sessions
  
      await this.save();
      return token;
    } catch (err) {
    console.error('Could not create auth token:', err.message);
    throw err;
  }
};
  
  // Stored in the "Admin" collection of the Library_Management database.
  const Admin = mongoose.model("ADMIN", AdminSchema, "Admin");
  module.exports = Admin;