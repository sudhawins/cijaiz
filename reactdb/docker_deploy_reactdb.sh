#!/bin/bash

docker compose -f reactdb-compose.yml down
docker compose -f reactdb-compose.yml up -d --pull always