const Koa = require('koa');
const Router = require('koa-router');
const session = require('koa-session');
const SpotifyWebApi = require('spotify-web-api-node');
const logger = require('./config/logger');
const sessionConfig = require('./config/session');
const {
  CLIENT_ID, CLIENT_SECRET, REDIRECT_URI, SCOPES, PLAYLIST_TRACKS_TOP_50,
} = require('./config/envVariable');

// setup koa with router
const app = new Koa();
const router = new Router();

// setup koa-session
app.keys = ['some secret hurr'];
app.use(session(sessionConfig, app));

const spotifyApi = new SpotifyWebApi({
  clientId: CLIENT_ID,
  clientSecret: CLIENT_SECRET,
  redirectUri: REDIRECT_URI,
});

// ### Auth ###

// LOGIN
router.get('/auth/login', async (ctx) => {
  // generate random state
  const state = Math.random().toString(36).substring(2, 15)
    + Math.random().toString(36).substring(2, 15);

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
router.get('/auth/callback', async (ctx) => {
  const { code } = ctx.query;
  const { state } = ctx.query;

  // check state and code are defined
  if (!code || !state) {
    ctx.response.status = 400;
    ctx.response.body = {
      error: 'Missing code or state',
    };
    return;
  }

  // check state if is the same
  if (state !== ctx.session.state) {
    ctx.response.status = 400;
    ctx.response.body = {
      error: 'Invalid state',
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
    !dataAccessToken.body.access_token
    || !dataAccessToken.body.refresh_token
  ) {
    ctx.response.status = 400;
    ctx.response.body = {
      message: 'Error to get access token or refresh token',
      error: dataAccessToken.toString(),
    };
    return;
  }

  // set access token on API
  spotifyApi.setAccessToken(dataAccessToken.body.access_token);
  spotifyApi.setRefreshToken(dataAccessToken.body.refresh_token);

  ctx.response.status = 200;
  ctx.response.body = {
    message: 'Successfully authenticated',
  };
});

// LOGOUT
router.get('/auth/logout', async (ctx) => {
  ctx.session = null;

  spotifyApi.setAccessToken(null);
  spotifyApi.setRefreshToken(null);

  ctx.response.status = 200;
  ctx.response.body = {
    message: 'Successfully logged out',
  };
});

// ### User ###
router.get('/user/top-tracks', async (ctx) => {
  const topTracks = [];
  let offset = 0;
  let total = 0;
  const limit = 50;

  logger.info('Inizio recupero delle tracce top.');

  try {
    let response;
    do {
      logger.info(
        `Esecuzione della chiamata API per le tracce top, offset: ${offset}`,
      );

      response = (
        // eslint-disable-next-line no-await-in-loop
        await spotifyApi.getMyTopTracks({
          limit,
          offset,
        })
      ).body;

      if (response.total === 0) {
        throw new Error('No top tracks found');
      }

      topTracks.push(...response.items);
      total = response.total;
      offset += limit;
    } while (offset < total);

    logger.info('Recupero delle tracce top completato.');
    logger.info(`Tracce recuperate: ${topTracks.length}`);
  } catch (error) {
    logger.error('Errore durante il recupero delle tracce top:', error.message);

    ctx.response.status = 400;
    ctx.response.body = {
      error: error.message,
    };
    return;
  }

  // delete all tracks from playlist
  try {
    logger.info('Eliminazione di tutte le tracce vecchie dalla playlist.');

    // get all older tracks from playlist
    const oldTracks = (
      await spotifyApi.getPlaylistTracks(PLAYLIST_TRACKS_TOP_50)
    ).body.items;

    if (oldTracks.length === 0) logger.info('Non ci sono tracce da eliminare.');
    else {
      const tracksToRemove = oldTracks.map((track) => ({
        uri: track.track.uri,
      }));

      const isRemovedTracks = await spotifyApi.removeTracksFromPlaylist(
        PLAYLIST_TRACKS_TOP_50,
        tracksToRemove,
      );

      if (!isRemovedTracks.body.snapshot_id) {
        throw new Error('Error to remove tracks from playlist');
      }

      logger.info('Tracce eliminate.');
    }
  } catch (error) {
    logger.error("Errore durante l'eliminazione delle tracce:", error.message);

    ctx.response.status = 400;
    ctx.response.body = {
      error: error.message,
    };
  }

  // add all new tracks to playlist
  try {
    logger.info('Inserimento di nuove tracce.');

    if (topTracks.length === 0) {
      logger.info('Non ci sono nuove tracce da inserire.');
      return;
    }

    const isAddedTracks = await spotifyApi.addTracksToPlaylist(
      PLAYLIST_TRACKS_TOP_50,
      topTracks.map((track) => track.uri),
    );

    if (!isAddedTracks.body.snapshot_id) {
      throw new Error('Error to add tracks to playlist');
    }

    logger.info('Tracce inserite.');

    ctx.response.status = 201;
    ctx.response.body = {
      message: 'Top tracks added successfully',
    };
  } catch (error) {
    logger.error("Errore durante l'inserimento delle tracce:", error.message);

    ctx.response.status = 400;
    ctx.response.body = {
      error: error.message,
    };
  }
});

app.use(router.routes());

app.listen(3000);
