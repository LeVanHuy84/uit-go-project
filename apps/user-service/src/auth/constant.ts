export const jwtConstants = {
  secret: process.env.JWT_SECRET || 'changeme_should_be_long_and_random',
  expiresIn: process.env.JWT_EXPIRES_IN || '1h',
};