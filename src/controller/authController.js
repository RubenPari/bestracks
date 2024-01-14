const spotifyApi = require('../config/spotifyClient');
const { SCOPES } = require('../config/envVariable');

const login = async (ctx) => {
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
};

const callback = async (ctx) => {
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
};

const logout = async (ctx) => {
  ctx.session = null;

  spotifyApi.setAccessToken(null);
  spotifyApi.setRefreshToken(null);

  ctx.response.status = 200;
  ctx.response.body = {
    message: 'Successfully logged out',
  };
};

module.exports = {
  login,
  callback,
  logout,
};
