import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey(),
    googleSub: text('google_sub'),
    email: text('email').notNull(),
    name: text('name').notNull(),
    avatarUrl: text('avatar_url'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex('users_google_sub_unique').on(table.googleSub),
    uniqueIndex('users_email_unique').on(table.email),
  ],
);

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  refreshTokenHash: text('refresh_token_hash').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const uploads = pgTable(
  'uploads',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    fileName: text('file_name').notNull(),
    mimeType: text('mime_type').notNull(),
    fileSize: integer('file_size').notNull(),
    status: text('status').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [uniqueIndex('uploads_key_unique').on(table.key)],
);

export const activities = pgTable('activities', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  uploadId: text('upload_id')
    .notNull()
    .references(() => uploads.id, { onDelete: 'cascade' }),
  sportType: text('sport_type').notNull().default('running'),
  sourceType: text('source_type').notNull().default('strava_sticker'),
  activityDate: timestamp('activity_date', { withTimezone: true }),
  distance: text('distance'),
  pace: text('pace'),
  time: text('time'),
  statsJson: jsonb('stats_json').notNull(),
  runningPathKey: text('running_path_key'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export type UserRow = typeof users.$inferSelect;
export type UploadRow = typeof uploads.$inferSelect;
export type ActivityRow = typeof activities.$inferSelect;
