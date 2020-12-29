
const express = require('express');
const router  = express.Router();

const User = require('../models/User.model');
const mongoose = require('mongoose');

const bcrypt = require('bcryptjs');
const saltRounds = 10;

const passport = require('passport');

const nodemailer = require("nodemailer");
const templates = require('../templates/template')
const async = require('async');
const crypto = require('crypto');



// Route to signup page
router.get('/signup', (req, res, next) => res.render('auth/signup'));

// Route for posting singup
router.post('/signup', (req, res, next) => {
  const { firstname, lastname, email, password } = req.body;

  if (!firstname || !lastname || !email || !password) {
    res.render('auth/signup', { errorMessage: 'All fields are mandatory. Please provide your first name, last name, email and password.' });
    return;
  }

  const regex = /(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{6,}/;
  if (!regex.test(password)) {
    res
      .status(500)
      .render('auth/signup', { errorMessage: 'Password needs to have at least 6 characters and must contain at least one number, one lowercase and one uppercase letter.' });
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
    .then(theUser => {
      passport.authenticate('local', { failureRedirect: "/signup"}, (err, theUser) => {
        if (err) {
          return next(err);
        }
        if (!theUser) {
          res.render('auth/signup', { errorMessage: 'There was a problem creating your account' });
          return;
        }
        req.login(theUser, err => {
          if (err) {
            return next(err);
          }
          res.redirect('/profile');
        });
      })(req, res, next);
    })
    .catch(error => {
      if (error instanceof mongoose.Error.ValidationError) {
        res.status(500).render('auth/signup', { errorMessage: error.message });
      } else if (error.code === 11000) {
        res.status(500).render('auth/signup', {
          errorMessage: 'Email needs to be unique. This email is already registered.'
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

router.get('/forgot', (req, res) => {
  res.render('auth/forgot', {
    user: req.user
  });
});

router.post('/forgot', (req, res, next) => {
  async.waterfall([
    function(done) {
      crypto.randomBytes(20, function(err, buf) {
        var token = buf.toString('hex');
        done(err, token);
      });
    },
    function(token, done) {
      User.findOne({ email: req.body.email }, function(err, user) {
        if (!user) {
          // req.flash('error', 'No account with that email address exists.');
          return res.redirect('/forgot');
        }

        user.resetPasswordToken = token;
        user.resetPasswordExpires = Date.now() + 3600000; // 1 hour

        user.save(function(err) {
          done(err, token, user);
        });
      });
    },
    function(token, user, done) {
      var smtpTransport = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.MAILER_E_MAIL,
          pass: process.env.MAILER_PASSWORD
        }
      });
      var mailOptions = {
        to: user.email,
        from: 'passwordreset@demo.com',
        subject: 'Node.js Password Reset',
        text: 'You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n' +
          'Please click on the following link, or paste this into your browser to complete the process:\n\n' +
          'http://' + req.headers.host + '/reset/' + token + '\n\n' +
          'If you did not request this, please ignore this email and your password will remain unchanged.\n'
      };
      smtpTransport.sendMail(mailOptions, function(err) {
        // req.flash('info', 'An e-mail has been sent to ' + user.email + ' with further instructions.');
        done(err, 'done');
      });
    }
  ], function(err) {
    if (err) return next(err);
    res.redirect('/forgot');
  });
});


// router.get('/reset', (req, res, next) => res.render('auth/reset'));


router.get('/reset/:token', function(req, res) {
  User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } }, function(err, user) {
    if (!user) {
      console.log('GET GET GET Password reset token is invalid or has expired.')
      // req.flash('error', 'Password reset token is invalid or has expired.');
      return res.redirect('/forgot');
    }
    res.render('auth/reset', {
      user: req.user
    });
  });
});

router.post('/reset/:token', function(req, res) {
  async.waterfall([
    function(done) {
      User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } }, function(err, user) {
        if (!user) {
          // req.flash('error', 'Password reset token is invalid or has expired.');
          return res.redirect('back');
        }

        user.password = req.body.password;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;

        user.save(function(err) {
          req.logIn(user, function(err) {
            done(err, user);
          });
        });
      });
    },
    function(user, done) {
      var smtpTransport = nodemailer.createTransport('SMTP', {
        service: 'gmail',
        auth: {
          user: process.env.MAILER_E_MAIL,
          pass: process.env.MAILER_PASSWORD
        }
      });
      var mailOptions = {
        to: user.email,
        from: 'passwordreset@demo.com',
        subject: 'Your password has been changed',
        text: 'Hello,\n\n' +
          'This is a confirmation that the password for your account ' + user.email + ' has just been changed.\n'
      };
      smtpTransport.sendMail(mailOptions, function(err) {
        // req.flash('success', 'Success! Your password has been changed.');
        done(err);
      });
    }
  ], function(err) {
    res.redirect('/');
  });
});

// router.post('/reset', (req, res, next) => {
//   async.waterfall([
//     function(done) {
//       console.log('Password reset')

//       User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } }, function(err, user) {
//         if (!user) {
//           console.log(`${user} <<< Password reset token is invalid or has expired.`)

//           // req.flash('error', 'Password reset token is invalid or has expired.');
//           return res.redirect('back');
//         }

//         user.password = req.body.password;
//         user.resetPasswordToken = undefined;
//         user.resetPasswordExpires = undefined;

//         user.save(function(err) {
//           console.log('Password expired.')

//           req.logIn(user, function(err) {
//             done(err, user);
//           });
//         });
//       });
//     },
//     function(user, done) {
//       var smtpTransport = nodemailer.createTransport({
//         service: 'gmail',
//         auth: {
//           user: process.env.MAILER_E_MAIL,
//           pass: process.env.MAILER_PASSWORD
//         }
//       });
//       var mailOptions = {
//         to: user.email,
//         from: 'passwordreset@demo.com',
//         subject: 'Your password has been changed',
//         text: 'Hello,\n\n' +
//           'This is a confirmation that the password for your account ' + user.email + ' has just been changed.\n'
//       };
//       smtpTransport.sendMail(mailOptions, function(err) {
//         console.log('Success! Your password has been changed.')
//         // req.flash('success', 'Success! Your password has been changed.');
//         done(err);
//       });
//     }
//   ], function(err) {
//     res.redirect('/');
//   });
// });


router.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'], prompt: 'select_account',}));

router.get('/auth/google/callback', 
  passport.authenticate('google', { failureRedirect: '/login' }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect('/profile');
  });

// LinkedIn
router.get('/auth/linkedin',
  passport.authenticate('linkedin'),
  function(req, res){
  });

router.get('/auth/linkedin/callback', 
  passport.authenticate('linkedin', { failureRedirect: '/login' }),
  function(req, res) {
    res.redirect('/profile');
  });

module.exports = router;
