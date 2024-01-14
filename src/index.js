const Koa = require('koa');
const session = require('koa-session');
const sessionConfig = require('./config/session');
const { PORT } = require('./config/envVariable');

const app = new Koa();
const { authRouter } = require('./router/router');
const { userRouter } = require('./router/router');

// setup koa-session
app.keys = ['some secret hurr'];
app.use(session(sessionConfig, app));

app.use(authRouter.routes());
app.use(authRouter.allowedMethods());

app.use(userRouter.routes());
app.use(userRouter.allowedMethods());

app.listen(PORT, () => {
  console.log(`server is running on port ${PORT}`);
});
