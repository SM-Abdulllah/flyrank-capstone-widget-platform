const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { env } = require('../config/env');
const userRepository = require('../repositories/userRepository');
const { AppError } = require('../errors');

async function login({ email, password }) {
  const user = await userRepository.findByEmail(email);

  if (!user) {
    throw new AppError(401, 'invalid_credentials', 'Invalid email or password');
  }

  const passwordMatches = await bcrypt.compare(password, user.password_hash);

  if (!passwordMatches) {
    throw new AppError(401, 'invalid_credentials', 'Invalid email or password');
  }

  const token = jwt.sign(
    {
      sub: user.id,
      tenant_id: user.tenant_id
    },
    env.JWT_SECRET,
    {
      expiresIn: '2h'
    }
  );

  return {
    token,
    user: {
      id: user.id,
      tenant_id: user.tenant_id,
      email: user.email
    }
  };
}

module.exports = {
  login
};

