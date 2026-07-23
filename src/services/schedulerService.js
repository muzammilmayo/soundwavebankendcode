const { Op } = require('sequelize');
const { Song, Album } = require('../models');

/**
 * Service to publish scheduled songs and albums when their scheduled_for date has passed.
 */
class SchedulerService {
  constructor() {
    this.intervalId = null;
  }

  start(intervalMs = 60000) { // Default runs every minute
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    console.log('[SchedulerService] Starting content scheduler...');
    this.intervalId = setInterval(async () => {
      await this.publishScheduledContent();
    }, intervalMs);
    
    // Run immediately on start
    this.publishScheduledContent();
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[SchedulerService] Stopped content scheduler.');
    }
  }

  async publishScheduledContent() {
    try {
      const now = new Date();
      
      // Update Songs
      const [updatedSongs] = await Song.update(
        { status: 'published' },
        { 
          where: { 
            status: 'scheduled',
            scheduled_for: { [Op.lte]: now }
          }
        }
      );
      if (updatedSongs > 0) {
        console.log(`[SchedulerService] Published ${updatedSongs} scheduled song(s).`);
      }

      // Update Albums
      const [updatedAlbums] = await Album.update(
        { status: 'published' },
        { 
          where: { 
            status: 'scheduled',
            scheduled_for: { [Op.lte]: now }
          }
        }
      );
      if (updatedAlbums > 0) {
        console.log(`[SchedulerService] Published ${updatedAlbums} scheduled album(s).`);
      }
    } catch (err) {
      console.error('[SchedulerService] Error publishing scheduled content:', err);
    }
  }
}

module.exports = new SchedulerService();
