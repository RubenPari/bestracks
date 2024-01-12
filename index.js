const Koa = require("koa");
const Router = require("koa-router");
const session = require("koa-session");
const SpotifyWebApi = require("spotify-web-api-node");
const logger = require("./config/logger");

require("dotenv").config();

const app = new Koa();
const router = new Router();

app.keys = ["some secret hurr"];

const sessionConfig = {
  key: "koa.sess",
  maxAge: 86400000,
  autoCommit: true,
  overwrite: true,
  httpOnly: true,
  signed: true,
  rolling: false,
  renew: false,
  secure: false,
  sameSite: null,
};

app.use(session(sessionConfig, app));

const SCOPES = process.env.SCOPES.split(",");
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;

if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI || !SCOPES) {
  throw new Error(
    "Missing environment variables: CLIENT_ID, CLIENT_SECRET, REDIRECT_URI, SCOPES",
  );
}

const spotifyApi = new SpotifyWebApi({
  clientId: CLIENT_ID,
  clientSecret: CLIENT_SECRET,
  redirectUri: REDIRECT_URI,
});

// ### Auth ###

// LOGIN
router.get("/auth/login", async (ctx) => {
  // generate random state
  const state =
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15);

  // save state to session
  ctx.session.state = state;

  let url = null;

  // create authorization URL
  try {
    url = spotifyApi.createAuthorizeURL(SCOPES, state);
  } catch (error) {
    ctx.response.status = 400;
    ctx.response.body = {
      error: error.message,
    };
    return;
  }

  ctx.response.redirect(url);
});

// CALLBACK
router.get("/auth/callback", async (ctx) => {
  const code = ctx.query.code;
  const state = ctx.query.state;

  // check state and code are defined
  if (!code || !state) {
    ctx.response.status = 400;
    ctx.response.body = {
      error: "Missing code or state",
    };
    return;
  }

  // check state if is the same
  if (state !== ctx.session.state) {
    ctx.response.status = 400;
    ctx.response.body = {
      error: "Invalid state",
    };
    return;
  }

  ctx.session.state = null;

  let dataAccessToken = null;

  // get access token
  try {
    dataAccessToken = await spotifyApi.authorizationCodeGrant(code);
  } catch (error) {
    ctx.response.status = 400;
    ctx.response.body = {
      error: error.message,
    };
    return;
  }

  // check access token
  if (
    !dataAccessToken.body["access_token"] ||
    !dataAccessToken.body["refresh_token"]
  ) {
    ctx.response.status = 400;
    ctx.response.body = {
      message: "Error to get access token or refresh token",
      error: dataAccessToken.toString(),
    };
    return;
  }

  // set access token on API
  spotifyApi.setAccessToken(dataAccessToken.body["access_token"]);
  spotifyApi.setRefreshToken(dataAccessToken.body["refresh_token"]);

  ctx.response.status = 200;
  ctx.response.body = {
    message: "Successfully authenticated",
  };
});

// LOGOUT
router.get("/auth/logout", async (ctx) => {
  ctx.session = null;

  spotifyApi.setAccessToken(null);
  spotifyApi.setRefreshToken(null);

  ctx.response.status = 200;
  ctx.response.body = {
    message: "Successfully logged out",
  };
});

// ### User ###
router.get("/user/top-tracks", async (ctx) => {
  let topTracks = [];
  let offset = 0;
  const limit = 50;

  logger.info('Inizio recupero delle tracce top.');

  try {
    let response;
    do {
      logger.info(`Esecuzione della chiamata API per le tracce top, offset: ${offset}`);

      response = (await spotifyApi.getMyTopTracks({
        limit: limit,
        offset: offset,
      })).body;

      topTracks.push(...response.items);
      offset += limit;

    } while (response.items.length === limit);

    logger.info('Recupero delle tracce top completato.');
    logger.info(`Tracce recuperate: ${topTracks.length}`);

  } catch(error) {
    logger.error("Errore durante il recupero delle tracce top:", error.message);

    ctx.response.status = 400;
    ctx.response.body = {
      message: "Error to get top tracks",
      error: error.message,
    };
    return;
  }

  ctx.response.status = 200;
  ctx.response.body = topTracks;
});

app.use(router.routes());

app.listen(3000);
