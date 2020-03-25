#!/bin/bash

#
# Period task to update data for COVID-19 US tool
#
# Note: The COVID19_US_DIR environment variable needs to be set in order
# for this script to work.
#
# Example crontab:
#
#   # set absolute path to live site, then invoke update script
#   COVID19_US_DIR=/home/someuser/git/covid19-us-live
#   @hourly $COVID19_US_DIR/bin/cron.sh
#

# exit immediately on error
set -eu

# old CSSE data repo
# # # update CSSE data repo
# cd "$COVID19_US_DIR/data/csse-daily/"
# git pull -q

# covidtracking source url and output file
CT_DAILY_URL="https://covidtracking.com/api/states/daily"
CT_DATA_DIR="$COVID19_US_DIR/data/covidtracking.com"
CT_DST_JSON="$CT_DATA_DIR/daily-$(date +%Y%m%d).json"

# download daily data, update symlink
mkdir -p "$CT_DATA_DIR"
curl -sSo "$CT_DST_JSON" "$CT_DAILY_URL"
ln -sf "$CT_DST_JSON" "$CT_DATA_DIR/../daily.json"

# generate public/data.json.tmp
cd "$COVID19_US_DIR"
./bin/bake.rb > ./public/data.json.tmp

# overwrite public/data.json
mv public/data.json{.tmp,}
