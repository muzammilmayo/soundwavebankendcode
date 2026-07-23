const sequelize = require("../config/db");
const { DataTypes } = require("sequelize");
const User = require("./user");
const Role = require("./role");
const Permission = require("./permission");
const RolePermission = require("./rolePermission");
const SongLike = require("./SongLike");
const ArtistFollower = require("./ArtistFollower");
const Feedback = require("./Feedback");
const SavedAlbum = require("./SavedAlbum");
const ListeningHistory = require("./ListeningHistory");
const Notification = require("./Notification");
const Playlist = require("./Playlist");
const PlaylistSong = require("./PlaylistSong");

// Import catalog models by calling their initializer functions
const Category = require("./Category")(sequelize, DataTypes);
const ArtistProfile = require("./ArtistProfile")(sequelize, DataTypes);
const Album = require("./Album")(sequelize, DataTypes);
const Song = require("./Song")(sequelize, DataTypes);

// Associations
User.belongsTo(Role, { foreignKey: "role_id" });
Role.hasMany(User, { foreignKey: "role_id" });

Role.belongsToMany(Permission, {
  through: RolePermission,
  foreignKey: "role_id",
  otherKey: "permission_id",
});
Permission.belongsToMany(Role, {
  through: RolePermission,
  foreignKey: "permission_id",
  otherKey: "role_id",
});

// User & ArtistProfile
User.hasOne(ArtistProfile, { foreignKey: "user_id", onDelete: "CASCADE" });
ArtistProfile.belongsTo(User, { foreignKey: "user_id" });

// ArtistProfile & Album
ArtistProfile.hasMany(Album, { foreignKey: "artist_profile_id", onDelete: "CASCADE" });
Album.belongsTo(ArtistProfile, { foreignKey: "artist_profile_id" });

// ArtistProfile & Song
ArtistProfile.hasMany(Song, { foreignKey: "artist_profile_id", onDelete: "CASCADE" });
Song.belongsTo(ArtistProfile, { foreignKey: "artist_profile_id" });

// Album & Song
Album.hasMany(Song, { foreignKey: "album_id", onDelete: "CASCADE" });
Song.belongsTo(Album, { foreignKey: "album_id" });

// Category & Song
Category.hasMany(Song, { foreignKey: "category_id", onDelete: "SET NULL" });
Song.belongsTo(Category, { foreignKey: "category_id" });

// User & SongLikes
User.belongsToMany(Song, { through: SongLike, foreignKey: "user_id", otherKey: "song_id", as: "likedSongs" });
Song.belongsToMany(User, { through: SongLike, foreignKey: "song_id", otherKey: "user_id", as: "likedByUsers" });

User.hasMany(SongLike, { foreignKey: "user_id" });
SongLike.belongsTo(User, { foreignKey: "user_id" });

Song.hasMany(SongLike, { foreignKey: "song_id" });
SongLike.belongsTo(Song, { foreignKey: "song_id" });

// User & ArtistFollowers
User.belongsToMany(ArtistProfile, { through: ArtistFollower, foreignKey: "user_id", otherKey: "artist_profile_id", as: "followedArtists" });
ArtistProfile.belongsToMany(User, { through: ArtistFollower, foreignKey: "artist_profile_id", otherKey: "user_id", as: "followers" });

User.hasMany(ArtistFollower, { foreignKey: "user_id" });
ArtistFollower.belongsTo(User, { foreignKey: "user_id" });

ArtistProfile.hasMany(ArtistFollower, { foreignKey: "artist_profile_id" });
ArtistFollower.belongsTo(ArtistProfile, { foreignKey: "artist_profile_id" });

// Song & Feedback
Song.hasMany(Feedback, { foreignKey: "song_id", onDelete: "CASCADE" });
Feedback.belongsTo(Song, { foreignKey: "song_id" });

// User & Feedback
User.hasMany(Feedback, { foreignKey: "user_id", onDelete: "CASCADE" });
Feedback.belongsTo(User, { foreignKey: "user_id" });

// User & SavedAlbums
User.belongsToMany(Album, { through: SavedAlbum, foreignKey: "user_id", otherKey: "album_id", as: "savedAlbums" });
Album.belongsToMany(User, { through: SavedAlbum, foreignKey: "album_id", otherKey: "user_id", as: "savedByUsers" });

User.hasMany(SavedAlbum, { foreignKey: "user_id" });
SavedAlbum.belongsTo(User, { foreignKey: "user_id" });

Album.hasMany(SavedAlbum, { foreignKey: "album_id" });
SavedAlbum.belongsTo(Album, { foreignKey: "album_id" });

// Song & ListeningHistory
Song.hasMany(ListeningHistory, { foreignKey: "song_id", onDelete: "CASCADE" });
ListeningHistory.belongsTo(Song, { foreignKey: "song_id" });

// User & ListeningHistory
User.hasMany(ListeningHistory, { foreignKey: "user_id", onDelete: "CASCADE" });
ListeningHistory.belongsTo(User, { foreignKey: "user_id" });

// User & Notifications
User.hasMany(Notification, { foreignKey: "user_id", onDelete: "CASCADE" });
Notification.belongsTo(User, { foreignKey: "user_id" });

// User & Playlists
User.hasMany(Playlist, { foreignKey: "user_id", onDelete: "CASCADE" });
Playlist.belongsTo(User, { foreignKey: "user_id" });

// Playlist & Songs (Many-to-Many through PlaylistSong)
Playlist.belongsToMany(Song, { through: PlaylistSong, foreignKey: "playlist_id", otherKey: "song_id", as: "songs" });
Song.belongsToMany(Playlist, { through: PlaylistSong, foreignKey: "song_id", otherKey: "playlist_id", as: "playlists" });

Playlist.hasMany(PlaylistSong, { foreignKey: "playlist_id" });
PlaylistSong.belongsTo(Playlist, { foreignKey: "playlist_id" });

Song.hasMany(PlaylistSong, { foreignKey: "song_id" });
PlaylistSong.belongsTo(Song, { foreignKey: "song_id" });

module.exports = {
  sequelize,
  User,
  Role,
  Permission,
  RolePermission,
  Category,
  ArtistProfile,
  Album,
  Song,
  SongLike,
  ArtistFollower,
  Feedback,
  SavedAlbum,
  ListeningHistory,
  Notification,
  Playlist,
  PlaylistSong,
};
