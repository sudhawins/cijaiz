#!/bin/bash

docker compose -f ecom-compose.yml down
docker compose -f ecom-compose.yml up -d --pull always