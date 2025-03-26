const express = require("express");
const app = express();
const mongoose = require("mongoose");
const path = require("path");
const methodOverride = require("method-override");
const ExpressError = require("./utils/ExpressError.js");
const posts = require("./routes/post.js");
const userRouter = require("./routes/user.js");
const reviews = require("./routes/review.js");
const session = require("express-session");
const flash = require("connect-flash");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const User = require("./models/user.js");
const dotenv = require("dotenv");

// Load environment variables from .env file
dotenv.config();

// Use environment variable with fallback
MONGO_URL = process.env.MONGO_URL ;

main()
  .then(() => {
    console.log("Connected to Database");
  })
  .catch((err) => {
    console.log(err);
  });

async function main() {
  await mongoose.connect(MONGO_URL);
}

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"));
app.use(express.static(path.join(__dirname, "public")));

const sessionOptions = {
  secret: process.env.SESSION_SECRET || "mysupersecretcode",
  resave: false,
  saveUninitialized: true,
  cookie: {
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
  },
};

// Setup session before using it in routes
app.use(session(sessionOptions));
app.use(flash());

// Passport configuration
app.use(passport.initialize());
app.use(passport.session());

// Configure passport local strategy with error handling
passport.use(
  new LocalStrategy(async function (username, password, done) {
    try {
      const user = await User.findOne({ username: username });
      if (!user) {
        return done(null, false, { message: "Invalid username or password" });
      }

      user.authenticate(password, function (err, user, passwordErr) {
        if (err) {
          return done(err);
        }

        if (passwordErr) {
          return done(null, false, { message: "Invalid username or password" });
        }

        return done(null, user);
      });
    } catch (err) {
      return done(err);
    }
  })
);
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// Flash middleware
app.use((req, res, next) => {
  res.locals.currUser = req.user;
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  next();
});

// Route to display signup form
app.get("/signup", (req, res) => {
  res.render("users/signup.ejs");
});

// Signup route with existing username check
app.post("/signup", async (req, res, next) => {
  try {
    const { username, email, password } = req.body;
    
    // Check if username already exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      req.flash("error", "Username already exists");
      return res.redirect("/signup");
    }
    
    // Check if email already exists (optional)
    if (email) {
      const existingEmail = await User.findOne({ email });
      if (existingEmail) {
        req.flash("error", "Email already in use");
        return res.redirect("/signup");
      }
    }
    
    // Create new user
    const newUser = new User({ username, email });
    const registeredUser = await User.register(newUser, password);
    
    // Login after successful registration
    req.login(registeredUser, (err) => {
      if (err) return next(err);
      req.flash("success", "Welcome to BlogNova!");
      res.redirect("/posts");
    });
  } catch (err) {
    req.flash("error", err.message);
    res.redirect("/signup");
  }
});

// Custom login route to handle authentication errors
app.post("/login", function (req, res, next) {
  passport.authenticate("local", function (err, user, info) {
    if (err) {
      return next(err);
    }

    if (!user) {
      req.flash("error", "Invalid username or password");
      return res.redirect("/login");
    }

    req.logIn(user, function (err) {
      if (err) {
        return next(err);
      }

      req.flash("success", "Welcome back!");
      return res.redirect("/posts");
    });
  })(req, res, next);
});

// Routes
app.get("/", (req, res) => {
  res.render("posts/home.ejs", { currUser: req.user });
});

app.get("/about", (req, res) => {
  res.render("about.ejs");
});

app.get("/contact", (req, res) => {
  res.render("contact.ejs");
});

app.get("/privacy-policy", (req, res) => {
  res.render("privacy.ejs");
});

app.use("/posts", posts);
app.use("/posts/:id/reviews", reviews);
app.use("/", userRouter);

// Error handling
app.all("*", (req, res, next) => {
  next(new ExpressError(404, "Page Not Found"));
});

app.use((err, req, res, next) => {
  console.error(err); // Add proper error logging
  let { statusCode = 500, message = "Something Went Wrong" } = err;
  res.status(statusCode).render("error.ejs", { message });
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`Listening on PORT ${PORT}`);
});