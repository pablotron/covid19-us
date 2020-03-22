#!/usr/bin/env ruby

#
# Compile disparate data sources, pre-aggregate data in a variety of
# ways, and then generate data.json on standard output.
#
# Note: This script _requires_ the data/csse-daily symlink in order to
# function properly.
#
# Example:
#   # generate public/data.json
#   > bin/bake.rb > public/data.json
#

require 'csv'
require 'json'
require 'pp'

DATA_DIR = File.expand_path('../data', __dir__)

# number of histogram buckets
NUM_BUCKETS = 8

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

DATA_COLS = {
  csse: [{
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
  }, {
    src:  'Latitude',
    dst:  :y,
    type: :float,
  }, {
    src:  'Longitude',
    dst:  :x,
    type: :float,
  }],

  areas: [{
    src:  'name',
    dst:  :name,
    type: :text,
  }, {
    src: 'area_all_sq_mi',
    dst: :area_all_sq_mi,
    type: :float,
  }, {
    src: 'area_land_sq_mi',
    dst: :area_land_sq_mi,
    type: :float,
  }],
}

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
      DATA[NAMES[row['Province/State']]][date] = DATA_COLS[:csse].each.with_object({
        date: date,
      }) do |col, r|
        val = row[col[:src]]
        r[col[:dst]] = case col[:type]
        when :int
          (val && val =~ /\d+/) ? val.to_i : 0
        when :float
          (val && val =~ /\d+/) ? val.to_f : 0
        else
          val
        end
      end
    end
  end
end

# load areas
AREAS = load_csv(File.expand_path('areas.csv', DATA_DIR)).map { |row|
  DATA_COLS[:areas].reduce({}) do |r, col|
    val = row[col[:src]]

    r[col[:dst]] = case col[:type]
    when :int
      val.to_i
    when :float
      val.to_f
    else
      val
    end

    r
  end
}.reduce({}) do |r, row|
  r[NAMES[row[:name]]] = row
  r
end

# build export data
REAL_DATA = DATA.keys.each.with_object({}) do |st, r|
  r[st] = DATA[st].keys.sort.map { |dk|
    DATA[st][dk].keys.select { |k|
      # exclude location
      ![:x, :y].include?(k)
    }.reduce({}) do |r2, k|
      r2[k] = DATA[st][dk][k]
      r2
    end
  }
end

# generate pre-sorted data
SORTS = {
  cases: INDEX.keys.map { |id|
    { id: id, val: REAL_DATA[id].last[:confirmed] }
  }.sort { |a, b|
    a[:val] <=> b[:val]
  },

  population: INDEX.keys.map { |id|
    { id: id, val: STATES[INDEX[id]][:population] }
  }.sort { |a, b|
    a[:val] <=> b[:val]
  },

  deaths: INDEX.keys.map { |id|
    { id: id, val: REAL_DATA[id].last[:deaths] }
  }.sort { |a, b|
    a[:val] <=> b[:val]
  },

  cases_per_capita: INDEX.keys.map { |id|
    hi = REAL_DATA[id].last[:confirmed]
    lo = STATES[INDEX[id]][:population]
    { id: id, val: 1.0 * hi / lo }
  }.sort { |a, b|
    a[:val] <=> b[:val]
  },

  cases_per_area_all: INDEX.keys.map { |id|
    hi = REAL_DATA[id].last[:confirmed]
    lo = AREAS[id][:area_all_sq_mi]
    { id: id, val: 1.0 * hi / lo }
  }.sort { |a, b|
    a[:val] <=> b[:val]
  },

  cases_per_area_land: INDEX.keys.map { |id|
    hi = REAL_DATA[id].last[:confirmed]
    lo = AREAS[id][:area_land_sq_mi]
    { id: id, val: 1.0 * hi / lo }
  }.sort { |a, b|
    a[:val] <=> b[:val]
  },

  deaths_per_capita: INDEX.keys.map { |id|
    hi = REAL_DATA[id].last[:deaths]
    lo = STATES[INDEX[id]][:population]
    { id: id, val: 1.0 * hi / lo }
  }.sort { |a, b|
    a[:val] <=> b[:val]
  },

  deaths_per_area_all: INDEX.keys.map { |id|
    hi = REAL_DATA[id].last[:deaths]
    lo = AREAS[id][:area_all_sq_mi]
    { id: id, val: 1.0 * hi / lo }
  }.sort { |a, b|
    a[:val] <=> b[:val]
  },

  deaths_per_area_land: INDEX.keys.map { |id|
    hi = REAL_DATA[id].last[:deaths]
    lo = AREAS[id][:area_land_sq_mi]
    { id: id, val: 1.0 * hi / lo }
  }.sort { |a, b|
    a[:val] <=> b[:val]
  },

  population_per_area_all: INDEX.keys.map { |id|
    hi = STATES[INDEX[id]][:population]
    lo = AREAS[id][:area_all_sq_mi]
    { id: id, val: 1.0 * hi / lo }
  }.sort { |a, b|
    a[:val] <=> b[:val]
  },

  population_per_area_land: INDEX.keys.map { |id|
    hi = STATES[INDEX[id]][:population]
    lo = AREAS[id][:area_land_sq_mi]
    { id: id, val: 1.0 * hi / lo }
  }.sort { |a, b|
    a[:val] <=> b[:val]
  },
}

puts JSON({
  states: {
    data: STATES,
    index: INDEX,
  },

  sorts: SORTS.keys.each.with_object({}) do |k, r|
    r[k] = SORTS[k].map { |row| row[:id] }
  end,

  # number of buckets in histograms
  num_buckets: NUM_BUCKETS,

  # generate histograms
  hists: SORTS.keys.each.with_object({}) do |k, r|
    max = SORTS[k].last[:val]
    coef = 1.0 * max / NUM_BUCKETS
    r[k] = NUM_BUCKETS.times.map { |i|
      min = coef * i
      max = coef * (i + 1)

      {
        min: min,
        max: max,
        ids: SORTS[k].select { |row|
          row[:val] >= min && row[:val] < max
        }.map { |row| row[:id] },
      }
    }
  end,

  data: REAL_DATA,
})
