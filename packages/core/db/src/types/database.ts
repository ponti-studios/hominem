import type { ColumnType } from 'kysely';

export type Generated<T> =
  T extends ColumnType<infer S, infer I, infer U>
    ? ColumnType<S, I | undefined, U>
    : ColumnType<T, T | undefined, T>;

export type Int8 = ColumnType<string, bigint | number | string, bigint | number | string>;

export type Json = JsonValue;

export type JsonArray = JsonValue[];

export type JsonObject = {
  [K in string]?: JsonValue;
};

export type JsonPrimitive = boolean | number | string | null;

export type JsonValue = JsonArray | JsonObject | JsonPrimitive;

export type Numeric = ColumnType<string, number | string, number | string>;

export type Timestamp = ColumnType<Date, Date | string, Date | string>;

export interface Account {
  accessToken: string | null;
  accessTokenExpiresAt: Timestamp | null;
  accountId: string;
  createdAt: Generated<Timestamp>;
  id: string;
  idToken: string | null;
  password: string | null;
  providerId: string;
  refreshToken: string | null;
  refreshTokenExpiresAt: Timestamp | null;
  scope: string | null;
  updatedAt: Generated<Timestamp>;
  userId: string;
}

export interface AppBookmarks {
  createdat: Generated<Timestamp>;
  description: string | null;
  id: Generated<string>;
  metadata: Generated<Json>;
  owner_userid: string;
  place_id: string | null;
  title: string;
  updatedat: Generated<Timestamp>;
  url: string;
}

export interface AppChatMessages {
  author_userid: string | null;
  chat_id: string;
  content: string;
  createdat: Generated<Timestamp>;
  files: Json | null;
  id: Generated<string>;
  parent_message_id: string | null;
  reasoning: string | null;
  referenced_note_ids: Json | null;
  role: string;
  tool_calls: Json | null;
  updatedat: Generated<Timestamp>;
}

export interface AppChats {
  archived_at: Timestamp | null;
  createdat: Generated<Timestamp>;
  id: Generated<string>;
  last_message_at: Generated<Timestamp>;
  note_id: string | null;
  owner_userid: string;
  primary_space_id: string | null;
  source: string | null;
  title: string;
  updatedat: Generated<Timestamp>;
}

export interface AppEntities {
  createdat: Generated<Timestamp>;
  entity_id: string;
  entity_table: string;
  owner_userid: string | null;
  primary_space_id: string | null;
  updatedat: Generated<Timestamp>;
}

export interface AppEntityLinks {
  createdat: Generated<Timestamp>;
  from_entity_id: string;
  from_entity_table: string;
  id: Generated<string>;
  metadata: Generated<Json>;
  owner_userid: string;
  relation_type: string;
  space_id: string | null;
  to_entity_id: string;
  to_entity_table: string;
  updatedat: Generated<Timestamp>;
  valid_during: Generated<string>;
}

export interface AppEventAttendees {
  createdat: Generated<Timestamp>;
  email: string | null;
  event_id: string;
  id: Generated<string>;
  person_id: string | null;
  responded_at: Timestamp | null;
  role: Generated<string>;
  status: Generated<string>;
  updatedat: Generated<Timestamp>;
}

export interface AppEvents {
  color: string | null;
  createdat: Generated<Timestamp>;
  description: string | null;
  ends_at: Timestamp | null;
  event_type: string;
  external_id: string | null;
  id: Generated<string>;
  is_all_day: Generated<boolean>;
  metadata: Generated<Json>;
  owner_userid: string;
  place_id: string | null;
  recurrence: Generated<Json>;
  source: string | null;
  starts_at: Timestamp;
  title: string;
  updatedat: Generated<Timestamp>;
}

export interface AppFiles {
  content: string | null;
  createdat: Generated<Timestamp>;
  id: string;
  metadata: Json | null;
  mimetype: string;
  original_name: string;
  owner_userid: string;
  size: number;
  storage_key: string;
  text_content: string | null;
  updatedat: Generated<Timestamp>;
  url: string;
}

export interface AppFinanceAccounts {
  account_subtype: string | null;
  account_type: string;
  accountid: string | null;
  available_balance: Numeric | null;
  createdat: Generated<Timestamp>;
  currency_code: Generated<string>;
  current_balance: Numeric | null;
  id: Generated<string>;
  institution_id: string | null;
  is_active: Generated<boolean>;
  mask: string | null;
  metadata: Generated<Json>;
  name: string;
  owner_userid: string;
  plaid_item_id: string | null;
  provider: string | null;
  updatedat: Generated<Timestamp>;
}

export interface AppFinanceInstitutions {
  country_code: string | null;
  createdat: Generated<Timestamp>;
  id: Generated<string>;
  logo_url: string | null;
  name: string;
  provider: string | null;
  provider_institution_id: string | null;
  updatedat: Generated<Timestamp>;
  website_url: string | null;
}

export interface AppFinanceTransactions {
  account_id: string;
  amount: Numeric;
  createdat: Generated<Timestamp>;
  description: string | null;
  external_id: string | null;
  id: Generated<string>;
  merchant_name: string | null;
  notes: string | null;
  occurred_at: Timestamp | null;
  owner_userid: string;
  pending: Generated<boolean>;
  posted_on: Timestamp;
  provider_payload: Generated<Json>;
  source: string | null;
  transaction_type: string;
  updatedat: Generated<Timestamp>;
}

export interface AppGoals {
  createdat: Generated<Timestamp>;
  description: string | null;
  id: Generated<string>;
  owner_userid: string;
  status: Generated<string>;
  target_at: Timestamp | null;
  title: string;
  updatedat: Generated<Timestamp>;
}

export interface AppKeyResults {
  createdat: Generated<Timestamp>;
  current_value: Numeric | null;
  due_at: Timestamp | null;
  goal_id: string;
  id: Generated<string>;
  target_value: Numeric | null;
  title: string;
  unit: string | null;
  updatedat: Generated<Timestamp>;
}

export interface AppMusicAlbums {
  album_art_url: string | null;
  artist_id: string | null;
  artist_name: string | null;
  createdat: Generated<Timestamp>;
  external_id: string | null;
  genre: string | null;
  id: Generated<string>;
  metadata: Generated<Json>;
  owner_userid: string;
  release_date: Timestamp | null;
  source: string;
  title: string;
  updatedat: Generated<Timestamp>;
}

export interface AppMusicArtists {
  createdat: Generated<Timestamp>;
  external_id: string | null;
  genre: string | null;
  id: Generated<string>;
  image_url: string | null;
  metadata: Generated<Json>;
  name: string;
  owner_userid: string;
  source: string;
  updatedat: Generated<Timestamp>;
}

export interface AppMusicListens {
  completed: Generated<boolean>;
  context_id: string | null;
  context_type: string | null;
  createdat: Generated<Timestamp>;
  duration_seconds: number | null;
  ended_at: Timestamp | null;
  id: Generated<string>;
  owner_userid: string;
  source: string;
  started_at: Timestamp;
  track_id: string | null;
  updatedat: Generated<Timestamp>;
}

export interface AppMusicPlaylists {
  createdat: Generated<Timestamp>;
  description: string | null;
  external_id: string | null;
  id: Generated<string>;
  image_url: string | null;
  is_public: Generated<boolean>;
  metadata: Generated<Json>;
  name: string;
  owner_userid: string;
  source: string;
  updatedat: Generated<Timestamp>;
}

export interface AppMusicPlaylistTracks {
  added_at: Generated<Timestamp>;
  playlist_id: string;
  position: number;
  track_id: string;
}

export interface AppMusicTracks {
  album_art_url: string | null;
  album_id: string | null;
  album_name: string | null;
  artist_id: string | null;
  artist_name: string | null;
  createdat: Generated<Timestamp>;
  disc_number: number | null;
  duration_seconds: number | null;
  external_id: string | null;
  genre: string | null;
  id: Generated<string>;
  isrc: string | null;
  metadata: Generated<Json>;
  owner_userid: string;
  source: string;
  title: string;
  track_number: number | null;
  updatedat: Generated<Timestamp>;
}

export interface AppNoteFiles {
  attached_at: Generated<Timestamp>;
  file_id: string;
  note_id: string;
}

export interface AppNotes {
  archived_at: Timestamp | null;
  content: Generated<string>;
  createdat: Generated<Timestamp>;
  current_version_id: string | null;
  excerpt: string | null;
  id: Generated<string>;
  is_locked: Generated<boolean>;
  owner_userid: string;
  parent_note_id: string | null;
  source: string | null;
  title: string | null;
  updatedat: Generated<Timestamp>;
}

export interface AppNoteShares {
  access_period: Generated<string | null>;
  createdat: Generated<Timestamp>;
  expiresat: Timestamp | null;
  granted_by_userid: string | null;
  id: Generated<string>;
  note_id: string;
  permission: Generated<string>;
  revokedat: Timestamp | null;
  shared_with_userid: string;
}

export interface AppNoteVersions {
  analysis: Json | null;
  content: string | null;
  created_by_userid: string | null;
  createdat: Generated<Timestamp>;
  excerpt: string | null;
  id: Generated<string>;
  mentions: Generated<Json>;
  note_id: string;
  note_type: Generated<string>;
  published_at: Timestamp | null;
  publishing_metadata: Json | null;
  scheduled_for: Timestamp | null;
  status: Generated<string>;
  title: string | null;
  updatedat: Generated<Timestamp>;
  version_number: number;
}

export interface AppPeople {
  createdat: Generated<Timestamp>;
  email: string | null;
  ended_at: Timestamp | null;
  first_name: string | null;
  id: Generated<string>;
  image: string | null;
  last_name: string | null;
  metadata: Generated<Json>;
  notes: string | null;
  owner_userid: string;
  person_type: Generated<string>;
  phone: string | null;
  started_at: Timestamp | null;
  updatedat: Generated<Timestamp>;
}

export interface AppPlaces {
  address: string | null;
  createdat: Generated<Timestamp>;
  external_id: string | null;
  id: Generated<string>;
  latitude: Numeric | null;
  longitude: Numeric | null;
  name: string;
  notes: string | null;
  owner_userid: string;
  place_type: string | null;
  provider_payload: Generated<Json>;
  rating: Numeric | null;
  source: string | null;
  updatedat: Generated<Timestamp>;
}

export interface AppPlaidItems {
  accesstoken: string | null;
  createdat: Generated<Timestamp>;
  cursor: string | null;
  error_code: string | null;
  error_message: string | null;
  id: Generated<string>;
  institution_id: string | null;
  last_synced_at: Timestamp | null;
  owner_userid: string;
  provider: Generated<string>;
  provider_item_id: string;
  status: Generated<string>;
  updatedat: Generated<Timestamp>;
}

export interface AppPossessionContainers {
  createdat: Generated<Timestamp>;
  description: string | null;
  id: Generated<string>;
  location: string | null;
  name: string;
  owner_userid: string;
  updatedat: Generated<Timestamp>;
}

export interface AppPossessionEvents {
  amount: Numeric | null;
  amount_unit: string | null;
  container_id: string | null;
  createdat: Generated<Timestamp>;
  end_date: Timestamp | null;
  event_type: string;
  id: Generated<string>;
  metadata: Generated<Json>;
  method: string | null;
  occurred_at: Timestamp | null;
  owner_userid: string;
  possessionid: string;
  start_date: Timestamp | null;
  updatedat: Generated<Timestamp>;
}

export interface AppPossessions {
  container_id: string | null;
  createdat: Generated<Timestamp>;
  current_value: Numeric | null;
  description: string | null;
  id: Generated<string>;
  item_condition: string | null;
  location: string | null;
  metadata: Generated<Json>;
  name: string;
  owner_userid: string;
  purchase_date: Timestamp | null;
  purchase_price: Numeric | null;
  serial_number: string | null;
  updatedat: Generated<Timestamp>;
}

export interface AppSpaceInvites {
  accepted_at: Timestamp | null;
  createdat: Generated<Timestamp>;
  expiresat: Generated<Timestamp>;
  id: Generated<string>;
  invite_token: string;
  invite_window: Generated<string | null>;
  invited_user_email: string;
  invited_user_email_normalized: Generated<string | null>;
  invited_userid: string | null;
  inviter_userid: string;
  revokedat: Timestamp | null;
  space_id: string;
  status: Generated<string>;
  updatedat: Generated<Timestamp>;
}

export interface AppSpaceItems {
  added_at: Generated<Timestamp>;
  added_by_userid: string | null;
  entity_id: string;
  entity_table: string;
  id: Generated<string>;
  is_pinned: Generated<boolean>;
  membership_period: Generated<string | null>;
  metadata: Generated<Json>;
  position: Numeric | null;
  removed_at: Timestamp | null;
  space_id: string;
}

export interface AppSpaceMembers {
  added_by_userid: string | null;
  createdat: Generated<Timestamp>;
  id: Generated<string>;
  membership_period: Generated<string>;
  space_id: string;
  userid: string;
}

export interface AppSpaces {
  color: string | null;
  createdat: Generated<Timestamp>;
  description: string | null;
  icon: string | null;
  id: Generated<string>;
  is_ordered: Generated<boolean>;
  name: string;
  owner_userid: string;
  updatedat: Generated<Timestamp>;
}

export interface AppSpaceTags {
  created_by_userid: string | null;
  createdat: Generated<Timestamp>;
  id: Generated<string>;
  space_id: string;
  tag_id: string;
}

export interface AppTagAliases {
  alias: string;
  alias_slug: string;
  createdat: Generated<Timestamp>;
  id: Generated<string>;
  tag_id: string;
}

export interface AppTagAssignments {
  assigned_by_userid: string | null;
  assignment_period: Generated<string | null>;
  assignment_source: Generated<string>;
  confidence: Numeric | null;
  createdat: Generated<Timestamp>;
  entity_id: string;
  entity_table: string;
  id: Generated<string>;
  removed_at: Timestamp | null;
  tag_id: string;
}

export interface AppTags {
  archived_at: Timestamp | null;
  color: string | null;
  created_by_userid: string | null;
  createdat: Generated<Timestamp>;
  description: string | null;
  icon: string | null;
  id: Generated<string>;
  name: string;
  owner_userid: string;
  path: string;
  slug: string;
  updatedat: Generated<Timestamp>;
}

export interface AppTaskAssignments {
  assigned_by_userid: string | null;
  assignee_userid: string;
  assignment_period: Generated<string>;
  createdat: Generated<Timestamp>;
  id: Generated<string>;
  metadata: Generated<Json>;
  primary_space_id: string;
  task_id: string;
}

export interface AppTasks {
  completed_at: Timestamp | null;
  createdat: Generated<Timestamp>;
  description: string | null;
  due_at: Timestamp | null;
  id: Generated<string>;
  owner_userid: string;
  parent_task_id: string | null;
  primary_space_id: string | null;
  priority: Generated<string>;
  status: Generated<string>;
  title: string;
  updatedat: Generated<Timestamp>;
}

export interface AppTravelTrips {
  createdat: Generated<Timestamp>;
  description: string | null;
  end_date: Timestamp | null;
  id: Generated<string>;
  name: string;
  notes: string | null;
  owner_userid: string;
  start_date: Timestamp;
  status: Generated<string>;
  updatedat: Generated<Timestamp>;
}

export interface AppVideoChannels {
  createdat: Generated<Timestamp>;
  description: string | null;
  external_id: string | null;
  handle: string | null;
  id: Generated<string>;
  image: string | null;
  metadata: Generated<Json>;
  name: string;
  owner_userid: string;
  source: string;
  subscriber_count: number | null;
  updatedat: Generated<Timestamp>;
}

export interface AppVideoViews {
  channel_id: string | null;
  channel_name: string | null;
  completed: Generated<boolean>;
  content_type: string;
  createdat: Generated<Timestamp>;
  description: string | null;
  duration_seconds: number | null;
  episode_number: number | null;
  external_id: string | null;
  id: Generated<string>;
  metadata: Generated<Json>;
  owner_userid: string;
  season_number: number | null;
  source: string;
  thumbnail_url: string | null;
  title: string;
  updatedat: Generated<Timestamp>;
  watch_time_seconds: Generated<number>;
  watched_at: Timestamp;
}

export interface DeviceCode {
  clientId: string | null;
  deviceCode: string;
  expiresAt: Timestamp;
  id: string;
  lastPolledAt: Timestamp | null;
  pollingInterval: number | null;
  scope: string | null;
  status: string;
  userCode: string;
  userId: string | null;
}

export interface GooseDbVersion {
  id: Generated<number>;
  is_applied: boolean;
  tstamp: Generated<Timestamp>;
  version_id: Int8;
}

export interface Jwks {
  createdAt: Timestamp;
  expiresAt: Timestamp | null;
  id: string;
  privateKey: string;
  publicKey: string;
}

export interface OpsAuditLogs {
  action: string;
  actor_userid: string | null;
  createdat: Generated<Timestamp>;
  entity_id: string | null;
  entity_schema: string | null;
  entity_table: string | null;
  id: Generated<string>;
  metadata: Generated<Json>;
}

export interface OpsSearchLogs {
  actor_userid: string | null;
  clicked_entity_id: string | null;
  clicked_entity_type: string | null;
  createdat: Generated<Timestamp>;
  id: Generated<string>;
  metadata: Generated<Json>;
  query: string;
  results_count: number | null;
  scope: string | null;
}

export interface Passkey {
  aaguid: string | null;
  backedUp: Generated<boolean>;
  counter: Generated<number>;
  createdAt: Timestamp | null;
  credentialID: string;
  deviceType: string;
  id: string;
  name: string | null;
  publicKey: string;
  transports: string | null;
  userId: string;
}

export interface Session {
  createdAt: Generated<Timestamp>;
  expiresAt: Timestamp;
  id: string;
  ipAddress: string | null;
  token: string;
  updatedAt: Generated<Timestamp>;
  userAgent: string | null;
  userId: string;
}

export interface User {
  createdAt: Generated<Timestamp>;
  email: string;
  emailVerified: Generated<boolean>;
  id: string;
  image: string | null;
  name: string;
  updatedAt: Generated<Timestamp>;
}

export interface Verification {
  createdAt: Timestamp | null;
  expiresAt: Timestamp;
  id: string;
  identifier: string;
  updatedAt: Timestamp | null;
  value: string;
}

export interface DB {
  account: Account;
  'app.bookmarks': AppBookmarks;
  'app.chat_messages': AppChatMessages;
  'app.chats': AppChats;
  'app.entities': AppEntities;
  'app.entity_links': AppEntityLinks;
  'app.event_attendees': AppEventAttendees;
  'app.events': AppEvents;
  'app.files': AppFiles;
  'app.finance_accounts': AppFinanceAccounts;
  'app.finance_institutions': AppFinanceInstitutions;
  'app.finance_transactions': AppFinanceTransactions;
  'app.goals': AppGoals;
  'app.key_results': AppKeyResults;
  'app.music_albums': AppMusicAlbums;
  'app.music_artists': AppMusicArtists;
  'app.music_listens': AppMusicListens;
  'app.music_playlist_tracks': AppMusicPlaylistTracks;
  'app.music_playlists': AppMusicPlaylists;
  'app.music_tracks': AppMusicTracks;
  'app.note_files': AppNoteFiles;
  'app.note_shares': AppNoteShares;
  'app.note_versions': AppNoteVersions;
  'app.notes': AppNotes;
  'app.people': AppPeople;
  'app.places': AppPlaces;
  'app.plaid_items': AppPlaidItems;
  'app.possession_containers': AppPossessionContainers;
  'app.possession_events': AppPossessionEvents;
  'app.possessions': AppPossessions;
  'app.space_invites': AppSpaceInvites;
  'app.space_items': AppSpaceItems;
  'app.space_members': AppSpaceMembers;
  'app.space_tags': AppSpaceTags;
  'app.spaces': AppSpaces;
  'app.tag_aliases': AppTagAliases;
  'app.tag_assignments': AppTagAssignments;
  'app.tags': AppTags;
  'app.task_assignments': AppTaskAssignments;
  'app.tasks': AppTasks;
  'app.travel_trips': AppTravelTrips;
  'app.video_channels': AppVideoChannels;
  'app.video_views': AppVideoViews;
  deviceCode: DeviceCode;
  goose_db_version: GooseDbVersion;
  jwks: Jwks;
  'ops.audit_logs': OpsAuditLogs;
  'ops.search_logs': OpsSearchLogs;
  passkey: Passkey;
  session: Session;
  user: User;
  verification: Verification;
}
