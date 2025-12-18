const jwt = require('jsonwebtoken');
const JWT_SECRET = '9322ea0149cea44d8d8325f7d030cc00c4ea671dd69cb25554bd11bfe2233b093dbac8a35bb4fb4362eb694075e21a4857ade959e169a5177b859a806a371394';

const userId = '68e660438b2fc15fb41d454f';
const token = jwt.sign({ sub: userId, role: 'admin' }, JWT_SECRET, { expiresIn: '1d' });

console.log('Use this link to log in:');
console.log(`http://localhost:3000/api/auth/callback?token=${encodeURIComponent(token)}`);
console.log('\nOr use this token in your requests:');
console.log(`Authorization: Bearer ${token}`);
