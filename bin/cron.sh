#!/bin/bash

#
# Periodic task to update data.json.
#
# Note: The COVID19_US_DIR environment variable needs to be set to the
# absolute path of the base covid19-us directory in order for this
# script to work.
#
# Example crontab entry:
#
#   # set absolute path to live site, then invoke update script
#   COVID19_US_DIR=/home/someuser/git/covid19-us-live
#   @hourly $COVID19_US_DIR/bin/cron.sh
#

# fail on unset variables, and exit immediately on error
set -eu

# covidtracking source url
CT_DAILY_URL="https://covidtracking.com/api/states/daily.json"

# absolute path to directory for json output from covidtracking api
CT_DATA_DIR="$COVID19_US_DIR/data/covidtracking.com"

# daily api JSON output path
CT_DST_JSON="$CT_DATA_DIR/daily-$(date +%Y%m%d).json"

# make sure directory for json output from covidtracking api exists
mkdir -p "$CT_DATA_DIR"

# download daily data, update symlink to current daily data
curl -sSo "$CT_DST_JSON" "$CT_DAILY_URL"
ln -sf "$CT_DST_JSON" "$CT_DATA_DIR/../daily.json"

# switch to working directory
cd "$COVID19_US_DIR"

# run bake.rb to generate JSON and write it to public/data.json.tmp
#
# (note: we write the output to data.json.tmp instead of data.json in
# so bake.rb can safely fail without nuking the live data.json)
./bin/bake.rb > ./public/data.json.tmp

# overwrite public/data.json
mv public/data.json{.tmp,}
