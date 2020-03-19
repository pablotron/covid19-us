#!/usr/env/ruby

require 'csv'

CSV(STDOUT) do |csv|
  csv << %w{state population}
  CSV(STDIN, headers: true).each do |row|
    csv << [row['name'], row['pop_est_2019'].gsub(/,/, '').to_i]
  end
end
