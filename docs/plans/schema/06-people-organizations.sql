-- Up: no external_identities table; person_type duplication flagged, not fixed.
CREATE TABLE app.people (
  id uuid PRIMARY KEY DEFAULT uuidv7(), owner_userid text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  person_type text NOT NULL DEFAULT 'person' CHECK (person_type IN ('person','company','organization')), -- see chapter divergence note
  first_name text, last_name text, email text, phone text, image text, notes text, metadata jsonb NOT NULL DEFAULT '{}',
  started_at timestamptz, ended_at timestamptz, createdAt timestamptz NOT NULL DEFAULT now(), updatedAt timestamptz NOT NULL DEFAULT now(),
  CHECK (ended_at IS NULL OR started_at IS NULL OR ended_at >= started_at)
);
CREATE TABLE app.person_aliases (
  id uuid PRIMARY KEY DEFAULT uuidv7(), owner_userid text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE, person_id uuid NOT NULL REFERENCES app.people(id) ON DELETE CASCADE,
  alias text NOT NULL CHECK (btrim(alias) <> ''), alias_kind text NOT NULL DEFAULT 'name', createdAt timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE app.person_contact_methods (
  id uuid PRIMARY KEY DEFAULT uuidv7(), owner_userid text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE, person_id uuid NOT NULL REFERENCES app.people(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('email','phone','address','url','handle')), value text NOT NULL CHECK (btrim(value) <> ''), label text, is_primary boolean NOT NULL DEFAULT false,
  createdAt timestamptz NOT NULL DEFAULT now(), updatedAt timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE app.organizations (
  id uuid PRIMARY KEY DEFAULT uuidv7(), owner_userid text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (btrim(name) <> ''), website_url text, kind text, metadata jsonb NOT NULL DEFAULT '{}',
  createdAt timestamptz NOT NULL DEFAULT now(), updatedAt timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE app.organization_memberships (
  id uuid PRIMARY KEY DEFAULT uuidv7(), owner_userid text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE, organization_id uuid NOT NULL REFERENCES app.organizations(id) ON DELETE CASCADE,
  person_id uuid REFERENCES app.people(id) ON DELETE SET NULL, role text, started_at timestamptz, ended_at timestamptz, metadata jsonb NOT NULL DEFAULT '{}',
  createdAt timestamptz NOT NULL DEFAULT now(), updatedAt timestamptz NOT NULL DEFAULT now(),
  CHECK (ended_at IS NULL OR started_at IS NULL OR ended_at >= started_at)
);
CREATE TABLE app.person_relationships (
  id uuid PRIMARY KEY DEFAULT uuidv7(), owner_userid text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  from_person_id uuid NOT NULL REFERENCES app.people(id) ON DELETE CASCADE, to_person_id uuid NOT NULL REFERENCES app.people(id) ON DELETE CASCADE,
  relationship_type text NOT NULL CHECK (btrim(relationship_type) <> ''), started_at timestamptz, ended_at timestamptz, metadata jsonb NOT NULL DEFAULT '{}',
  createdAt timestamptz NOT NULL DEFAULT now(), updatedAt timestamptz NOT NULL DEFAULT now(),
  CHECK (from_person_id <> to_person_id), CHECK (ended_at IS NULL OR started_at IS NULL OR ended_at >= started_at)
);
CREATE TABLE app.social_interactions (
  id uuid PRIMARY KEY DEFAULT uuidv7(), owner_userid text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE, person_id uuid REFERENCES app.people(id) ON DELETE SET NULL,
  occurred_at timestamptz NOT NULL, interaction_type text NOT NULL CHECK (btrim(interaction_type) <> ''), source text, metadata jsonb NOT NULL DEFAULT '{}',
  createdAt timestamptz NOT NULL DEFAULT now(), updatedAt timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE app.user_social_links (
  user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE, github text, linkedin text, twitter text, website text,
  createdAt timestamptz NOT NULL DEFAULT now(), updatedAt timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE app.event_attendees ADD CONSTRAINT event_attendees_person_id_fkey FOREIGN KEY (person_id) REFERENCES app.people(id) ON DELETE SET NULL;
