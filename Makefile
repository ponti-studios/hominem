# Makefile for Node.js, Docker, Fastify, and Drizzle project

# Variables
DOCKER_COMPOSE = docker compose
NODE_ENV ?= development

# Phony targets
.PHONY: install start dev build test lint format clean docker-up docker-down check reset all

# Install dependencies
install:
	npm install

# Start the application in production mode
start:
	npm start

# Start the application in development mode
dev:
	npm run dev


# Run tests
test:
	npm test

# Build the application
build:
	npm run build

# Run linter
lint:
	npm run lint

# Format code
format:
	npm run format

# Clean build artifacts and dependencies
clean:
	find apps packages -type d -name "node_modules" -exec rm -rf {} +
	find apps packages -type d -name "dist" -exec rm -rf {} +
	find apps packages -type d -name "build" -exec rm -rf {} +
	

# Start Docker containers
docker-up:
	$(DOCKER_COMPOSE) up -d

# Stop Docker containers
docker-down:
	$(DOCKER_COMPOSE) down

# Run all tests and linting
check: test lint

# Full cleanup and reinstall
reset: clean install

# Default target
all: install build
