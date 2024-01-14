// load environment variables
require('dotenv').config();

const SCOPES = process.env.SCOPES.split(',');
const { CLIENT_ID } = process.env;
const { CLIENT_SECRET } = process.env;
const { REDIRECT_URI } = process.env;
const { ID_PLAYLIST_TRACKS_TOP_50 } = process.env;
const { PORT } = process.env;

if (
  !CLIENT_ID
  || !CLIENT_SECRET
  || !REDIRECT_URI
  || !SCOPES
  || !ID_PLAYLIST_TRACKS_TOP_50
  || !PORT
) {
  throw new Error(
    'Missing environment variables: CLIENT_ID, CLIENT_SECRET, REDIRECT_URI, SCOPES, ID_PLAYLIST_TRACKS_TOP_50, PORT',
  );
}

module.exports = {
  SCOPES,
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI,
  ID_PLAYLIST_TRACKS_TOP_50,
  PORT,
};
