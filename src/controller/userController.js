const logger = require('../config/logger');
const spotifyApi = require('../config/spotifyClient');
const { ID_PLAYLIST_TRACKS_TOP_50 } = require('../config/envVariable');

const getTopTracks = async (ctx) => {
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
      await spotifyApi.getPlaylistTracks(ID_PLAYLIST_TRACKS_TOP_50)
    ).body.items;

    if (oldTracks.length === 0) logger.info('Non ci sono tracce da eliminare.');
    else {
      const tracksToRemove = oldTracks.map((track) => ({
        uri: track.track.uri,
      }));

      const isRemovedTracks = await spotifyApi.removeTracksFromPlaylist(
        ID_PLAYLIST_TRACKS_TOP_50,
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
      ID_PLAYLIST_TRACKS_TOP_50,
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
};

module.exports = {
  getTopTracks,
};
