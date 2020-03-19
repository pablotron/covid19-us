#!/usr/bin/env ruby

#
# Generate data.json on standard output.
#

require 'csv'
require 'json'

DATA_DIR = File.expand_path('../data', __dir__)

def load_csv(path)
  CSV(File.open(path, 'rb'), headers: true).map { |row| row.to_h }
end

# load states
STATES = load_csv(File.expand_path('states.csv', DATA_DIR)).map { |row|
  { state: row['state'], name: row['name'] }
}

# build state index
INDEX = STATES.size.times.with_object({}) do |i, r|
  r[STATES[i][:state]] = i
end

# build state name to state map
NAMES = STATES.each.with_object({}) do |row, r|
  r[row[:name]] = row[:state]
end

# load populations, add to states
load_csv(File.expand_path('populations.csv', DATA_DIR)).each do |row|
  if st = NAMES[row['state']]
    STATES[INDEX[st]][:population] = row['population'].to_i
  end
end

DATE_RE = %r{\A(?<m>\d+)-(?<d>\d+)-(?<y>\d+)\.csv\Z}

DATA_COLS = [{
  src:  'Last Update', 
  dst:  :last_updated,
  type: :date,
}, {
  src:  'Confirmed',
  dst:  :confirmed,
  type: :int,
}, {
  src:  'Deaths',
  dst:  :deaths,
  type: :int,
}, {
  src:  'Recovered',
  dst:  :recovered,
  type: :int,
}]

DATA = Hash.new do |h, k|
  h[k] = Hash.new { |h2, k2| h2[k2] = {} }
end

# load time series data
Dir['%s/%s' % [DATA_DIR, 'csse-daily/*.csv']].each do |csv_path|
  if md = File.basename(csv_path).match(DATE_RE)
    date = '%04d-%02d-%02d' % [md[:y].to_i, md[:m].to_i, md[:d].to_i]
    load_csv(csv_path).select { |row|
      row['Country/Region'] == 'US' &&
      NAMES.key?(row['Province/State'])
    }.each do |row|
      DATA[NAMES[row['Province/State']]][date] = DATA_COLS.each.with_object({
        date: date,
      }) do |col, r|
        val = row[col[:src]]
        r[col[:dst]] = case col[:type]
        when :int
          (val && val =~ /\d+/) ? val.to_i : 0
        else
          val
        end
      end
    end
  end
end

puts JSON({
  states: {
    data: STATES,
    index: INDEX,
  },

  data: DATA.keys.each.with_object({}) do |st, r|
    r[st] = DATA[st].keys.sort.map { |dk| DATA[st][dk] }
  end,
})
