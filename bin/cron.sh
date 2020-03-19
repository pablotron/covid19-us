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

# update CSSE data repo
cd "$COVID19_US_DIR/data/csse-daily/"
git pull

# generate public/data.json.tmp
cd "$COVID19_US_DIR"
./bin/gen-data.rb > ./public/data.json.tmp

# overwrite public/data.json
mv public/data.json{.tmp,}
