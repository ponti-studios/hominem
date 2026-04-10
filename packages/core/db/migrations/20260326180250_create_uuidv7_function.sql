-- +goose Up
-- +goose StatementBegin
CREATE OR REPLACE FUNCTION public.uuidv7()
RETURNS uuid
AS $$
DECLARE
  timestamp_ms bigint;
  timestamp_parts text;
  random_parts text;
BEGIN
  -- Get current timestamp in milliseconds
  timestamp_ms := (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

  -- Convert timestamp to hex and pad to 12 characters
  timestamp_parts := LPAD(TO_HEX(timestamp_ms), 12, '0');

  -- Generate random parts (sub-millisecond randomness + clock sequence + node)
  random_parts := ENCODE(gen_random_bytes(10), 'hex');

  -- Construct UUIDv7: timestamp (12 chars) + random (12 chars) + version/variant
  -- Set version to 7 (0111 in first 4 bits of 7th byte)
  -- Set variant to RFC 4122 (10 in first 2 bits)
  RETURN (
    SUBSTRING(timestamp_parts, 1, 8) || '-' ||
    SUBSTRING(timestamp_parts, 9, 4) || '-' ||
    '7' || SUBSTRING(random_parts, 2, 3) || '-' ||
    '8' || SUBSTRING(random_parts, 5, 3) || '-' ||
    SUBSTRING(random_parts, 8, 12)
  )::uuid;
END;
$$ LANGUAGE plpgsql;
-- +goose StatementEnd

-- +goose Down
DROP FUNCTION IF EXISTS public.uuidv7();
