#!/usr/bin/env just --justfile

set shell := ["bash", "-euo", "pipefail", "-c"]
set positional-arguments := true

ROOT_DIR := justfile_directory()
COMMAND := ROOT_DIR / "scripts" / "command"

setup:
    bash "{{ COMMAND }}" setup

dev scope='all':
    bash "{{ COMMAND }}" dev "{{ scope }}"

lint first='all' second='':
    bash "{{ COMMAND }}" lint "{{ first }}" "{{ second }}"

format first='write' second='':
    bash "{{ COMMAND }}" format "{{ first }}" "{{ second }}"

typecheck scope='all':
    bash "{{ COMMAND }}" typecheck "{{ scope }}"

build scope='all':
    bash "{{ COMMAND }}" build "{{ scope }}"

test scope='all':
    bash "{{ COMMAND }}" test "{{ scope }}"

check scope='all':
    bash "{{ COMMAND }}" check "{{ scope }}"

db action target='':
    bash "{{ COMMAND }}" db "{{ action }}" "{{ target }}"

mobile action target='':
    bash "{{ COMMAND }}" mobile "{{ action }}" "{{ target }}"

eval action config='':
    bash "{{ COMMAND }}" eval "{{ action }}" "{{ config }}"

mcp action target='':
    bash "{{ COMMAND }}" mcp "{{ action }}" "{{ target }}"

deploy provider service config:
    bash "{{ COMMAND }}" deploy "{{ provider }}" "{{ service }}" "{{ config }}"
