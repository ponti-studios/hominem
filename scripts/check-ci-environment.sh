#!/bin/bash
# CI Environment Validator
# Checks that local environment matches CI requirements before running tests
# Prevents "passes locally, fails in CI" failures by validating environment parity

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
CHECKS_PASSED=0
CHECKS_FAILED=0

check_tool_version() {
  local tool=$1
  local required_version=$2
  local command=$3

  echo -n "Checking $tool version... "

  if ! command -v "$tool" &> /dev/null; then
    echo -e "${RED}✗ NOT INSTALLED${NC}"
    echo "  → Install $tool version $required_version"
    echo "  → Using asdf: asdf install $tool $required_version"
    ((CHECKS_FAILED++))
    return 1
  fi

  local actual_version
  actual_version=$(eval "$command" | head -n1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' || echo "unknown")

  if [ "$actual_version" = "$required_version" ]; then
    echo -e "${GREEN}✓ $actual_version${NC}"
    ((CHECKS_PASSED++))
    return 0
  else
    echo -e "${YELLOW}⚠ $actual_version (expected $required_version)${NC}"
    echo "  → Consider updating: asdf install $tool $required_version && asdf global $tool $required_version"
    ((CHECKS_PASSED++)) # Warning, not failure
    return 0
  fi
}

check_docker() {
  echo -n "Checking Docker... "

  if ! command -v docker &> /dev/null; then
    echo -e "${RED}✗ NOT INSTALLED${NC}"
    echo "  → Install Docker: https://docs.docker.com/install"
    ((CHECKS_FAILED++))
    return 1
  fi

  if ! docker info &> /dev/null; then
    echo -e "${RED}✗ DAEMON NOT RUNNING${NC}"
    echo "  → Start Docker daemon"
    ((CHECKS_FAILED++))
    return 1
  fi

  echo -e "${GREEN}✓ Running${NC}"
  ((CHECKS_PASSED++))
  return 0
}

check_docker_compose() {
  echo -n "Checking Docker Compose... "

  if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo -e "${RED}✗ NOT INSTALLED${NC}"
    echo "  → Install Docker Compose: https://docs.docker.com/compose/install"
    ((CHECKS_FAILED++))
    return 1
  fi

  echo -e "${GREEN}✓ Available${NC}"
  ((CHECKS_PASSED++))
  return 0
}

check_service_health() {
  local service_name=$1
  local port=$2
  local check_command=$3

  echo -n "Checking $service_name (port $port)... "

  # Check if port is listening
  if nc -z localhost "$port" &> /dev/null; then
    # Additional health check if provided
    if [ -n "$check_command" ] && eval "$check_command" &> /dev/null; then
      echo -e "${GREEN}✓ Healthy${NC}"
      ((CHECKS_PASSED++))
      return 0
    elif [ -z "$check_command" ]; then
      echo -e "${GREEN}✓ Listening${NC}"
      ((CHECKS_PASSED++))
      return 0
    else
      echo -e "${YELLOW}⚠ Listening but health check failed${NC}"
      ((CHECKS_PASSED++))
      return 0
    fi
  else
    echo -e "${RED}✗ Not responding${NC}"
    echo "  → Start services: docker compose -f infra/compose/base.yml -f infra/compose/dev.yml up -d"
    ((CHECKS_FAILED++))
    return 1
  fi
}

check_env_file() {
  echo -n "Checking .env file... "

  if [ ! -f "infra/compose/.env" ]; then
    echo -e "${YELLOW}⚠ Not found${NC}"
    echo "  → Create from template: cp infra/compose/.env.example infra/compose/.env"
    ((CHECKS_PASSED++))
    return 0
  fi

  echo -e "${GREEN}✓ Found${NC}"
  ((CHECKS_PASSED++))
  return 0
}

check_database_migration() {
  echo -n "Checking migration setup... "

  if ! command -v goose &> /dev/null; then
    echo -e "${YELLOW}⚠ Goose not in PATH${NC}"
    echo "  → Will be installed by 'just setup'"
    ((CHECKS_PASSED++))
    return 0
  fi

  echo -e "${GREEN}✓ Available${NC}"
  ((CHECKS_PASSED++))
  return 0
}

print_header() {
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}CI Environment Validation${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
}

print_summary() {
  echo ""
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "Checks passed: ${GREEN}$CHECKS_PASSED${NC}"
  echo -e "Checks failed: ${RED}$CHECKS_FAILED${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

  if [ $CHECKS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ Environment ready! You can run tests.${NC}"
    return 0
  else
    echo -e "${RED}✗ Environment issues found. Fix above and retry.${NC}"
    return 1
  fi
}

main() {
  print_header

  # Tool versions
  echo -e "${BLUE}Tool Versions:${NC}"
  check_tool_version "bun" "1.3.0" "bun --version"
  check_tool_version "node" "22.14.0" "node --version"
  check_tool_version "just" "1.36.0" "just --version"
  echo ""

  # Docker
  echo -e "${BLUE}Docker:${NC}"
  check_docker
  check_docker_compose
  echo ""

  # Services
  echo -e "${BLUE}Services:${NC}"

  # Check if services are running first
  if docker compose -f infra/compose/base.yml -f infra/compose/dev.yml ps 2>/dev/null | grep -q "redis\|postgres"; then
    check_service_health "Redis" "6379" "redis-cli -p 6379 ping"
    check_service_health "PostgreSQL (test)" "4433" "psql -h localhost -p 4433 -U postgres -d hominem-test -c 'SELECT 1' 2>/dev/null"
  else
    echo -e "${YELLOW}ℹ Docker services not running${NC}"
    echo "  → Start with: docker compose -f infra/compose/base.yml -f infra/compose/dev.yml up -d"
    ((CHECKS_FAILED++))
  fi
  echo ""

  # Configuration
  echo -e "${BLUE}Configuration:${NC}"
  check_env_file
  check_database_migration
  echo ""

  print_summary
}

main "$@"
