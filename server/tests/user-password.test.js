const { test } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

// Replace only database I/O; validation, save hooks, and password checks stay real.
test('new passwords are stored unchanged and authenticate after loading', async (t) => {
  let stored;
  t.mock.method(User.collection, 'insertOne', async (document) => {
    stored = structuredClone(document);
    return { acknowledged: true, insertedId: document._id };
  });
  const user = new User({ name: 'Test', email: 'test@example.com', password: 'Example123!' });
  await user.save();
  assert.equal(stored.password, 'Example123!');
  const loaded = User.hydrate(stored);
  assert.equal(await loaded.matchPassword('Example123!'), true);
  assert.equal(await loaded.matchPassword('wrong-password'), false);
  assert.equal(await loaded.matchPassword(undefined), false);
});

test('existing hashes still authenticate but cannot be used as the password', async () => {
  const hash = await bcrypt.hash('Legacy123!', 4);
  const user = User.hydrate({ password: hash });
  assert.equal(await user.matchPassword('Legacy123!'), true);
  assert.equal(await user.matchPassword('wrong-password'), false);
  assert.equal(await user.matchPassword(hash), false);
  assert.equal(await user.matchPassword(undefined), false);
});

test('saving unrelated changes preserves legacy password authentication', async (t) => {
  let update;
  t.mock.method(User.collection, 'updateOne', async (filter, changes) => {
    update = changes;
    return { acknowledged: true, matchedCount: 1, modifiedCount: 1 };
  });
  const hash = await bcrypt.hash('Legacy123!', 4);
  const user = User.hydrate({ _id: new User()._id, name: 'Test', email: 'test@example.com', password: hash });
  user.isFirstLogin = false;
  await user.save();
  assert.equal(update.$set.password, undefined);
  assert.equal(await user.matchPassword('Legacy123!'), true);
});

test('resetting an existing password stores the replacement unchanged', async (t) => {
  let update;
  t.mock.method(User.collection, 'updateOne', async (filter, changes) => {
    update = changes;
    return { acknowledged: true, matchedCount: 1, modifiedCount: 1 };
  });
  const original = { _id: new User()._id, name: 'Test', email: 'test@example.com', password: await bcrypt.hash('Legacy123!', 4) };
  const user = User.hydrate(original);
  user.password = 'Replacement123!';
  await user.save();
  assert.equal(update.$set.password, 'Replacement123!');
  const loaded = User.hydrate({ ...original, ...update.$set });
  assert.equal(await loaded.matchPassword('Replacement123!'), true);
  assert.equal(await loaded.matchPassword('Legacy123!'), false);
});

test('a new password resembling a bcrypt hash is treated literally', async (t) => {
  let stored;
  t.mock.method(User.collection, 'insertOne', async (document) => {
    stored = structuredClone(document);
    return { acknowledged: true, insertedId: document._id };
  });
  const password = await bcrypt.hash('Different123!', 4);
  await User.create({ name: 'Test', email: 'literal@example.com', password });
  assert.equal(stored.password, password);
  const loaded = User.hydrate(stored);
  assert.equal(await loaded.matchPassword(password), true);
  assert.equal(await loaded.matchPassword('Different123!'), false);
});
