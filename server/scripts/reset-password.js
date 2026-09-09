/**
 * Reset a user's password without touching any other data.
 *
 * Usage (run from the server/ folder):
 *   node scripts/reset-password.js amy581004@gmail.com "NewPass123"
 *
 * Optional third argument: pass "firstlogin" to also flip isFirstLogin
 * back to true, so the user is walked through setup again.
 *
 *   node scripts/reset-password.js amy581004@gmail.com "NewPass123" firstlogin
 *
 * Updates the password, its storage format, and the modification timestamp
 * (and optionally `isFirstLogin`). Other documents are left untouched.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const [, , emailArg, newPassword, flag] = process.argv;

if (!emailArg || !newPassword) {
  console.error('Usage: node scripts/reset-password.js <email> <newPassword> [firstlogin]');
  process.exit(1);
}

if (newPassword.length < 6) {
  console.error('Password must be at least 6 characters (schema minlength).');
  process.exit(1);
}

const email = emailArg.toLowerCase().trim();

(async () => {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    console.error('MONGO_URI is not set. Check server/.env');
    process.exit(1);
  }

  try {
    // No in-memory fallback here on purpose: if the real database is
    // unreachable we want a loud failure, not a throwaway database that
    // silently accepts the change and discards it.
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    console.log(`Connected to: ${mongoose.connection.host}/${mongoose.connection.name}`);

    const user = await User.findOne({ email });

    if (!user) {
      console.error(`No user found with email: ${email}`);
      const others = await User.find({}, 'email name').lean();
      if (others.length) {
        console.error('Existing users in this database:');
        others.forEach((u) => console.error(`  - ${u.email} (${u.name})`));
      } else {
        console.error('This database contains no users at all — you may be connected to the wrong one.');
      }
      process.exit(1);
    }

    console.log(`Found: ${user.name} <${user.email}>  _id=${user._id}`);
    // The model saves the replacement as plain text and marks its format.
    user.password = newPassword;

    if (flag === 'firstlogin') {
      user.isFirstLogin = true;
    }

    await user.save();

    console.log('Password updated.');

    // Prove the new password actually validates through the app's own method.
    const ok = await user.matchPassword(newPassword);
    console.log(ok ? 'Verified: the new password works.' : 'WARNING: verification failed.');

    if (flag === 'firstlogin') {
      console.log('isFirstLogin set back to true.');
    }

    console.log('\nDone. No other documents were modified.');
    process.exit(ok ? 0 : 1);
  } catch (err) {
    console.error(`Failed: ${err.message}`);
    process.exit(1);
  } finally {
    await mongoose.disconnect().catch(() => {});
  }
})();
