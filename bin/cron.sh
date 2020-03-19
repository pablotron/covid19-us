#!/bin/bash

CSSE_DIR=~/git/COVID-19
PUBLIC_DIR=~/sites/pmdn.org/data/covid19-us/public

# exit immediately on error
set -eu

# update CSSE data repo, then run "bin/gen-data.rb"
cd "$CSSE_DIR"
git pull

# run "bin/gen-data.rb" to generate public/data.json.tmp
cd "$PUBLIC_DIR"
../bin/gen-data.rb > ./data.json.tmp

# update data.json
mv data.json{.tmp,}
