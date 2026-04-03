DATABASE_URL = postgresql://postgres:postgres@127.0.0.1:5434/hominem

.PHONY: db-migrate db-drop db-status

db-migrate:
	goose -dir ./migrations postgres "$(DATABASE_URL)" up

db-drop:
	@current=$$(goose -dir ./migrations postgres "$(DATABASE_URL)" status 2>&1 | tail -n 1); \
	if [ -z "$$current" ] || printf '%s\n' "$$current" | grep -q "no migrations"; then \
		echo "No applied migrations to drop."; \
	else \
		goose -dir ./migrations postgres "$(DATABASE_URL)" down; \
	fi

db-status:
	goose -dir ./migrations postgres "$(DATABASE_URL)" status
