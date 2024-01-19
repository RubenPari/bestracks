const Router = require('koa-router');

const authController = require('../controller/authController');
const userController = require('../controller/userController');

const authRouter = new Router({ prefix: '/auth' });
const userRouter = new Router({ prefix: '/user' });

// ### AUTH ###
authRouter.get('/login', authController.login);
authRouter.get('/callback', authController.callback);
authRouter.get('/logout', authController.logout);

// ### USER ###
userRouter.post('/top-tracks', userController.getTopTracks);

module.exports = {
  authRouter,
  userRouter,
};
