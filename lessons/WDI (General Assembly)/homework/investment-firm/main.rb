require 'pry'
require 'yahoofinance'; $yf = YahooFinance
require_relative 'menu_functions'
root = File.dirname(File.absolute_path(__FILE__))
Dir.glob(root + '/models/*.rb') { |file| require_relative file }
require_relative 'seeds'

#require 'data_mapper'
#DataMapper.setup :default, "sqlite://#{Dir.pwd}/database.db"
#DataMapper.auto_upgrade!

$client = ''
$folios = ''


response = menu
while response != 4
  case response
    when 1 then log_in
    when 2 then open_account
    when 3 then admin
    when 4 then exit
    else puts "That is an invald response."
  end
  response = menu
end