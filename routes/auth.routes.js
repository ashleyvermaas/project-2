
const express = require('express');
const router  = express.Router();

const User = require('../models/User.model');
const mongoose = require('mongoose');

const bcrypt = require('bcryptjs');
const saltRounds = 10;

const passport = require('passport');

// Route to singup page
router.get('/signup', (req, res, next) => res.render('auth/signup'));

// Route for posting singup
router.post('/signup', (req, res, next) => {
  const {firstname, lastname, email, password} = req.body;

  if (!firstname || !lastname || !email || !password) {
    res.render('auth/signup', { errorMessage: 'All fields are mandatory. Please provide your first name, last name, email and password.' });
    return;
  }

  const regex = /(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{6,}/;
  if (!regex.test(password)) {
    res
      .status(500)
      .render('auth/signup', { errorMessage: 'Password needs to have at least 6 chars and must contain at least one number, one lowercase and one uppercase letter.' });
    return;
  }

  bcrypt.genSalt(saltRounds)
    .then(salt => bcrypt.hash(password, salt))
    .then(hashedPassword => {
      return User.create({
        firstname,
        lastname,
        email,
        passwordHash: hashedPassword
      });
    })
    .then(userFromDB => {
      console.log('Newly created user is: ', userFromDB);
      res.redirect('/profile');
    })
    .catch(error => {
      if (error instanceof mongoose.Error.ValidationError) {
        res.status(500).render('auth/signup', { errorMessage: error.message });
      } else if (error.code === 11000) {
        res.status(500).render('auth/signup', {
          errorMessage: 'Email need to be unique. Email is already used.'
        });
      } else {
        next(error);
      }
    }); 
});

// Route to login page
router.get('/login', (req, res) => res.render('auth/login'));

// Route to check for login/post
router.post('/login', (req, res, next) => {
  passport.authenticate('local', { failureRedirect: "/login"}, (err, theUser) => {
    if (err) {
      return next(err);
    }
    if (!theUser) {
      res.render('auth/login', { errorMessage: 'Wrong password or email address' });
      return;
    }
    req.login(theUser, err => {
      if (err) {
        return next(err);
      }
      res.redirect('/profile');
    });
  })(req, res, next);
});

// Route to logout
router.post('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});


module.exports = router;
