#!/usr/bin/env ruby

#
# Read the following data sources:
#
#   * census.gov county CSV files containing population, land area,
#     births, and deaths
#   * census.gov state CSV files containing population, land area,
#     births, and deaths
#   * GeoJSON files (generated from TIGER data) containing county geometry
#   * GeoJSON files (generated from TIGER data) containing state geometry
#   * covidtracking.com data files containing state metadata
#   * covidtracking.com data files containing state current COVID-19
#     counts
#
# Then generate the following output files:
#   * counties-*.json: County GeoJSON files containing geometry and
#     properties (see below).
#   * states-*.json: State GeoJSON files containing geometry and
#     properties (see below).
#   * data.json: Data file containing summary statistics, state and
#     county metadata, and current state and county COVID-19 counts
#
# The output state and county GeoJSON files contain the following
# properties:
#
#   * FIPS code
#   * name
#   * population estimate (2019)
#   * population density (derived)
#   * births (2019)
#   * deaths (2019)
#   * land area
#

require 'csv'
require 'json'
require 'pp'

# absolute path to data directory relative to this file
DATA_DIR = File.expand_path('../../data/new', __dir__)

# location types
LOC_TYPES = %i{states counties}

# source files
FILES = {
  # source CSV files
  csvs: [{
    # ID in output hash
    id: :counties,

    # source file path (relative to DATA_DIR)
    path: 'counties/co-est2019-alldata.csv',

    # source file encoding
    encoding: 'WINDOWS-1252',

    # row filter
    filter: proc { |row| %w{040 050}.include?(row['SUMLEV']) },

    # proc to map row to FIPS code
    fips: proc { |row| ('%s%s' % [row['STATE'], row['COUNTY']]).intern },

    # list of relevant columns and types
    cols: [{
      name: 'STATE',
      type: :text,
    }, {
      name: 'COUNTY',
      type: :text,
    }, {
      name: 'STNAME',
      type: :text,
    }, {
      name: 'CTYNAME',
      type: :text,
    }, {
      name: 'POPESTIMATE2019',
      type: :int,
    }, {
      name: 'BIRTHS2019',
      type: :int,
    }, {
      name: 'DEATHS2019',
      type: :int,
    }],
  }, {
    # identifier output hash
    id: :states,

    # source path (relative to DATA_DIR)
    path: 'states/nst-est2019-alldata.csv',

    # source file encoding
    encoding: 'WINDOWS-1252',

    # row filter
    filter: proc { |row| %w{040 050}.include?(row['SUMLEV']) },

    # proc to map row to FIPS code
    fips: proc { |row| ('%s000' % [row['STATE']]).intern },

    # list of relevant columns and types
    cols: [{
      name: 'STATE',
      type: :text,
    }, {
      name: 'NAME',
      type: :text,
    }, {
      name: 'POPESTIMATE2019',
      type: :int,
    }, {
      name: 'BIRTHS2019',
      type: :int,
    }, {
      name: 'DEATHS2019',
      type: :int,
    }],
  }, {
    # identifier output hash
    id: :land_area,

    # source path (relative to DATA_DIR)
    path: 'counties/LND01.csv',

    # source file encoding
    encoding: 'WINDOWS-1252',

    # row filter (exclude entire country)
    filter: proc { |row| row['STCOU'] != '00000' },

    # row to FIPS code map proc
    fips: proc { |row| row['STCOU'].intern },

    # list of relevant columns and types
    cols: [{
      name: 'Areaname',
      type: :text,
    }, {
      name: 'STCOU',
      type: :text,
    }, {
      name: 'LND110210D',
      type: :float,
    }],
  }, {
    # ID in output hash
    id: :counties_current,

    # source file path (relative to DATA_DIR)
    path: 'nytimes/live/us-counties.csv',

    # source file encoding
    encoding: 'UTF-8',

    # row filter (exclude rows w/o a FIPS code)
    filter: proc { |row| row['fips'] },

    # proc to map row to FIPS code
    fips: proc { |row| row['fips'].intern },

    # list of relevant columns and types
    cols: [{
      name: 'date',
      type: :text,
    }, {
      name: 'county',
      type: :text,
    }, {
      name: 'cases',
      type: :int,
    }, {
      name: 'deaths',
      type: :int,
    }, {
      name: 'confirmed_cases',
      type: :int,
    }, {
      name: 'confirmed_deaths',
      type: :int,
    }, {
      name: 'probable_cases',
      type: :int,
    }, {
      name: 'probable_deaths',
      type: :int,
    }],
  }],

  # source GeoJSON files
  geojsons: [{
    # type of features in input geojson file
    type: :counties,

    # source path
    path: 'counties/gz_2010_us_050_00_20m.json',

    # resolution of source path
    res:  :r20m,
  }, {
    # type of features in input geojson file
    type: :counties,

    # source path
    path: 'counties/gz_2010_us_050_00_5m.json',

    # resolution of source path
    res:  :r5m,
  }, {
    # type of features in input geojson file
    type: :counties,

    # source path
    path: 'counties/gz_2010_us_050_00_500k.json',

    # resolution of source path
    res:  :r500k,
  }, {
    # type of features in input geojson file
    type: :states,

    # source path
    path: 'states/gz_2010_us_040_00_20m.json',

    # resolution of source path
    res:  :r20m,
  }, {
    # type of features in input geojson file
    type: :states,

    # source path
    path: 'states/gz_2010_us_040_00_5m.json',

    # resolution of source path
    res:  :r5m,
  }, {
    # type of features in input geojson file
    type: :states,

    # source path
    path: 'states/gz_2010_us_040_00_500k.json',

    # resolution of source path
    res:  :r500k,
  }],

  # source covidtracking.com files
  covidtracking: [{
    path: 'states-info.json',
  }, {
    path: 'states-current.json',
  }, {
    path: 'states-daily.json',
  }],
}

# map of columns in LUT to output geojson feature properties
GEOJSON_PROPERTIES = {
  counties: [{
    src: :name,
    dst: :name,
  }, {
    src: :state,
    dst: :state,
  }, {
    src: :popestimate2019,
    dst: :population,
  }, {
    src: :births2019,
    dst: :births,
  }, {
    src: :deaths2019,
    dst: :deaths,
  }, {
    src: :land_area,
    dst: :land_area,
  }, {
    src: :density,
    dst: :density,
  }],

  states: [{
    src: :name,
    dst: :name,
  }, {
    src: :popestimate2019,
    dst: :population,
  }, {
    src: :births2019,
    dst: :births,
  }, {
    src: :deaths2019,
    dst: :deaths,
  }, {
    src: :land_area,
    dst: :land_area,
  }, {
    src: :density,
    dst: :density,
  }],
}

module Util
  #
  # Build absolute path to data file
  #
  def self.data_path(path)
    File.expand_path(path, DATA_DIR)
  end

  #
  # Build absolute path to output file
  #
  def self.out_path(path)
    File.expand_path('out/%s' % [path], DATA_DIR)
  end

  #
  # Decode value from CSV cell.
  #
  def self.decode(type, val)
    case type
    when :int
      val.to_i
    when :float
      val.to_f
    when :text
      val
    else
      raise "unknown value type: #{type}"
    end
  end

  #
  # generate feature FIPS code by file type
  #
  def self.get_feature_fips_code(type, props)
    (case type
    when :states
      # state: suffix STATE with 000
      '%s000' % [props['STATE']]
    when :counties
      # county: concatenate STATE and COUNTY
      '%s%s' % [props['STATE'], props['COUNTY']]
    else
      # unknown file type
      raise "unknown file type: #{type}"
    end).intern
  end
end

class OutputWriter
  # path to output directory
  attr :dir

  # list of output files
  attr :files

  #
  # create OutputWriter instance
  #
  def initialize(dir)
    @dir = dir
    @files = []
  end

  #
  # Write data returned by block to given path.
  #
  def write(path, &block)
    # get start time
    times = [Time.now]

    # build destination path
    abs_path = File.expand_path(path, @dir)

    # generate json
    json = JSON.unparse(block.call)

    # write json to destination file, get size
    size = File.write(abs_path, json)

    # get end time
    times << Time.now

    # add to list of output files
    @files << {
      path: path,
      size: size,
      time: times.last - times.first
    }
  end
end

#
# Collect minimum and maximum statistics from data.
#
class Stats
  #
  # create Stats instance
  #
  def initialize
    @h = Hash.new { |h, k| h[k] = {} }
  end

  #
  # Add value
  #
  def add(key, val)
    # update minimum
    min = @h[key][:min]
    @h[key][:min] = val if !min || val < min

    # update maximum
    max = @h[key][:max]
    @h[key][:max] = val if !max || val > max
  end

  #
  # Serialize instance as JSON.
  #
  def to_json(s)
    @h.to_json(s)
  end
end

# load CSV files
CSVS = FILES[:csvs].each.with_object({}) do |file, r|
  # build source path
  path = Util.data_path(file[:path])

  # read source CSV, filter and convert matching rows
  r[file[:id]] = CSV.foreach(path, encoding: file[:encoding], headers: true).select { |row|
    # limit to matching rows
    file[:filter].call(row)
  }.map do |row|
    # extract needed columns
    file[:cols].each.with_object({
      # generate FIPS code from row
      fips: file[:fips].call(row),
    }) do |col, rr|
      # get column value and convert it
      key = col[:name].downcase.intern
      rr[key] = Util.decode(col[:type], row[col[:name]])
    end
  end
end

# load geojson files
GEOJSONS = FILES[:geojsons].each.with_object(Hash.new do |h, k|
  h[k] = {}
end) do |file, r|
  # build source path
  path = Util.data_path(file[:path])

  # load file, parse json
  data = JSON.parse(File.read(path, encoding: 'UTF-8'))

  # extract features' geometry and relevant properties
  r[file[:type]][file[:res]] = data['features'].map { |row|
    # get feature properties
    props = row['properties']

    {
      # get feature fips code, name, and geometry
      fips: Util.get_feature_fips_code(file[:type], props),
      name: props['NAME'],
      geometry: row['geometry'],
    }
  }
end

# loading covidtracking data files
COVIDTRACKING = FILES[:covidtracking].each.with_object({}) do |row, r|
  # build absolute path to source file
  abs_path = Util.data_path('covidtracking.com/%s' % [row[:path]])

  # read/parse json
  r[row[:path]] = JSON.parse(File.read(abs_path, encoding: 'UTF-8'))
end

# build map of FIPS code to of attributes
LUT = LOC_TYPES.each.with_object({
  # map of state abbreviations to FIPS codes
  abbrs: {},

  missing: Hash.new { |h, k| h[k] = [] },

  stats: LOC_TYPES.each.with_object({}) do |type, r|
    r[type] = Stats.new
  end,

  data: Hash.new { |h, k| h[k] = {} },
}) do |type, r|
  name_key = (type == :counties) ? :ctyname : :name

  CSVS[type].each do |row|
    # update stats
    %i{popestimate2019}.each do |col|
      r[:stats][type].add(col, row[col])
    end

    # populate data
    r[:data][type][row[:fips]] = %i{state popestimate2019 births2019 deaths2019}.each.with_object({
      name: row[name_key],
    }) do |col, rr|
      rr[col] = row[col]
    end
  end
end

# add land area to LUT
CSVS[:land_area].each do |row|
  type = (row[:fips].to_s =~ /000$/) ? :states : :counties
  fips = row[:fips]

  unless LUT[:data][type].key?(fips)
    LUT[:missing][:land_area] << { fips: fips, row: row }
    next
  end

  # get population and land area, calculate density
  population = LUT[:data][type][fips][:popestimate2019]
  land_area = row[:lnd110210d]
  density = population / land_area

  {
    land_area: land_area,
    density: density,
  }.each do |col, val|
    # update stats
    LUT[:stats][type].add(col, val)

    # add data to LUT
    LUT[:data][type][fips][col] = val
  end
end

# add geometries to LUT
GEOJSONS.each do |type, res_hash|
  res_hash.each do |res, features|
    features.each do |row|
      # get FIPS code
      fips = row[:fips]

      unless LUT[:data][type].key?(fips)
        row = row.merge({ geometry: :omitted })
        LUT[:missing][:geometries] << { fips: fips, row: row }
        next
      end

      LUT[:data][type][fips][:geometries] ||= {}
      LUT[:data][type][fips][:geometries][res] = row[:geometry]
    end
  end
end

# add state metadata
COVIDTRACKING['states-info.json'].each do |row|
  # build FIPS code
  fips = ('%s000' % [row['fips']]).intern

  unless LUT[:data][:states].key?(fips)
    LUT[:missing][:state_metadata] << { fips: fips, row: row }
    next
  end

  # populate state abbreviation to FIPS map
  LUT[:abbrs][row['state']] = fips

  # add state metadata to LUT
  LUT[:data][:states][fips][:metadata] = row
end

# add state current data
COVIDTRACKING['states-current.json'].each do |row|
  # get FIPS code
  fips = LUT[:abbrs][row['state']]

  unless LUT[:data][:states].key?(fips)
    LUT[:missing][:state_current] << { fips: fips, row: row }
    next
  end

  # update LUT
  LUT[:data][:states][fips][:current] = row
end

# add state historical data
COVIDTRACKING['states-daily.json'].each do |row|
  # get FIPS code
  fips = LUT[:abbrs][row['state']]

  unless LUT[:data][:states].key?(fips)
    LUT[:missing][:state_history] << { fips: fips, row: row }
    next
  end

  # update LUT
  LUT[:data][:states][fips][:history] = row
end

# add county current data
CSVS[:counties_current].each do |row|
  # get FIPS code
  fips = row[:fips]

  unless LUT[:data][:counties].key?(fips)
    LUT[:missing][:counties_current] << { fips: fips, row: row }
    next
  end

  # update LUT
  LUT[:data][:counties][fips][:current] = row
end

# pp LUT

# init output writer
out = OutputWriter.new(Util.data_path('out'))

# write geojson files
threads = LOC_TYPES.each.with_object([]) do |type, threads|
  %i{r500k r5m r20m}.each.with_object(threads) do |res, threads|
    threads << Thread.new(type, res) do |type, res|
      # build destination path
      path = '%s-%s.json' % [type, res.to_s.gsub(/^r/, '')]

      out.write(path) do
        {
          type: 'FeatureCollection',
          features: LUT[:data][type].keys.sort.select { |fips|
            LUT[:data][type][fips].key?(:geometries)
          }.map { |fips|
            # get source row
            row = LUT[:data][type][fips]

            # build destination feature
            {
              type: 'Feature',
              geometry: row[:geometries][res],
              id: fips,

              # build feature properties
              properties: GEOJSON_PROPERTIES[type].each.with_object({
                id: fips,
                type: (type == :states) ? :state : :county,
              }) { |p, r| r[p[:dst]] = row[p[:src]] }
            }.tap { |r|
              # sanity check
              unless r[:properties][:name]
                raise "missing name property: geojson = #{r}, row = #{row}"
              end
            }
          },
        }
      end
    end
  end
end

# write data.json
threads << Thread.new do
  out.write('data.json') do
    {
      stats: LUT[:stats],

      # state metadata and current
      states: LUT[:data][:states].keys.each.with_object({}) do |fips, r|
        r[fips] = %i{metadata current}.each.with_object({}) do |col, rr|
          rr[col] = LUT[:data][:states][fips][col]
        end
      end,

      # counties current
      counties: LUT[:data][:counties].keys.each.with_object({}) do |fips, r|
        r[fips] = %i{current}.each.with_object({}) do |col, rr|
          rr[col] = LUT[:data][:counties][fips][col]
        end
      end,
    }
  end
end

# write missing.json
threads << Thread.new do
  out.write('missing.json') do
    # build json
    # FIXME: currently bombs
    # json = JSON.unparse(LUT[:missing])
    {}
  end
end

# wait for all threads to complete
threads.each { |thread| thread.join }

# print results to standard output as a JSON
puts JSON.pretty_generate({
  files: out.files
})
