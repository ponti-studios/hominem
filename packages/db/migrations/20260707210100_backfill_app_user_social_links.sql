-- +goose Up
-- +goose StatementBegin
WITH ranked AS (
  SELECT
    p.owner_userid,
    sl.github,
    sl.linkedin,
    sl.twitter,
    sl.website,
    sl.createdat,
    sl.updatedat,
    ROW_NUMBER() OVER (
      PARTITION BY p.owner_userid
      ORDER BY
        CASE WHEN p.id = upp.current_portfolio_id THEN 0 ELSE 1 END,
        p.updatedat DESC
    ) AS rn
  FROM app.social_links sl
  JOIN app.portfolios p ON p.id = sl.portfolio_id
  LEFT JOIN app.user_portfolio_preferences upp ON upp.user_id = p.owner_userid
)
INSERT INTO app.user_social_links (user_id, github, linkedin, twitter, website, createdat, updatedat)
SELECT owner_userid, github, linkedin, twitter, website, createdat, updatedat
FROM ranked
WHERE rn = 1
ON CONFLICT (user_id) DO NOTHING;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
TRUNCATE TABLE app.user_social_links;
-- +goose StatementEnd
