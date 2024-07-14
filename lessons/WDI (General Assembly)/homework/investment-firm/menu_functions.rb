def get
  gets.chomp
end

def titlr(string)
  "**************#{string}**************"
end

def print_each(list)
  x = ''; list.keys.each { |i| x += "#{i}   " }; puts x
end

def get_stock(symbol)
  $yf.get_standard_quotes(symbol)[symbol]
end

def menu
  puts `clear`
  puts titlr("  Welcome to #{$firm.name}  ")
  puts 'What can we help you with today?'
  puts '(1) Log_in '
  puts '(2) Open account '
  puts '(3) Admin'
  puts '(4) Exit '
  gets.to_i
end

def client_menu
  puts `clear`
  puts titlr("  Welcome #{$client.name}  ")
  puts '(1) Market Watch'
  puts '(2) Buy Stock'
  puts '(3) Sell Stocks'
  puts '(4) My Portfolios'
  puts '(5) Close Account'
  puts '(6) Sign out'
  response = gets.to_i
  case response
    when 1 then check_market
    when 2 then buy_stock
    when 3 then sell_stock
    when 4 then my_portfolio
    when 5 then close_account
    when 6 then sign_out
    else puts "That is an invald response."
  end
end

def admin
  puts `clear`
  puts 'Enter passcode:  '; a = get.to_i
  if a == 6666
    list_clients
  else puts 'Wrong passcode.'; gets
  end
end

def list_clients
  puts `clear`
  puts titlr('  Client Management  ')
  $firm.clients.values.each do |c|
    puts "Name: #{c.name}"
    puts "Address: #{c.address}"
    puts "Balance: #{c.balance}"
    print "Net Worth: "; puts (c.net_worth).round(2)
    puts "Portfolios:"
    c.portfolios.each do |k,v|
      puts "  #{k}:"
      puts "      Value: #{v.value.round(2)}"
      puts "      Stocks: "
      v.stocks.each do |x,y|
        print "        #{x}:   "
        print " Quantity: #{y[0]}  Bought At: #{y[1].price}  Total Value: #{y[0] * y[1].price}\n"
      end
    end
    puts
  end
  gets
end

def log_in
  puts `clear`
  puts "Username:  "
  username = get
  puts "Password: "
  password = get
  if $firm.logins.keys.include? username and $firm.logins[username] == password
     $client = $firm.clients[username]
     $folios = $client.portfolios
     puts "\nYou have successfully logged in!"; gets
     client_menu
  else
    puts "\nIncorrect Username and/or Password."
  end
end

def check_market
  puts `clear`
  puts titlr('  Market Watch  ')
  ['ORCL','AAPL','GOOG','JPM','C'].each do |s|
    stock =  get_stock(s)
    puts "\n#{stock.name}  ( #{stock.symbol} ) "
    puts "    Price: #{stock.lastTrade}   Change: #{stock.changePercent}\n"
  end
  gets
  client_menu
end

def my_portfolio
  puts `clear`
  x = $folios.size > 1 ? 'Portfolios' : 'Portfolio'
  puts titlr("  My #{x}  ")
  puts "\nCurrent Balance: #{$client.balance.round(2)}"
  $folios.values.each do |p|
    puts "#{p.name}:"
    puts "   Value: #{p.value.round(2)}"
    puts "   Stocks: "
    p.stocks.values.each do |s|
       puts "      #{s[1].name}:"
       puts "          Market Value: #{get_stock(s[1].symbol).lastTrade}"
       puts "          Paid: #{s[1].price}"
       puts "          Quantity: #{s[0]}"
       puts "          Investment Value: #{s[0] * s[1].price}"
    end
  end
  puts "\nYou currently do not have any portfolios." if $folios.size == 0
  puts "\n(1) Close portfolio   (2) New Portfolio "
  puts "(3) Move stock         (4) Menu"
  a = get.to_i
  case a
    when 1 then close_portfolio
    when 2 then new_portfolio
    when 3 then move_stock
    when 4 then client_menu
    else puts "That is not a valid response."; gets
  end
end

def sign_out
  puts `clear`
  $client = ''
  puts "You have been successfully logged out. Have a nice day!"; gets
  exit
end

def new_portfolio
  puts `clear`
  puts titlr('  New Portfolio  ')
  puts "What would you like to name your new portfolio?"
  name = get
  portfolio = Portfolio.new(name)
  $folios[name] = portfolio
  print "Your #{name} portfolio has been created."
  client_menu
end

def close_portfolio
  puts `clear`
  if $folios.size > 0
    puts 'Which portfolio would you like to close?'
    x = ''; $folios.each { |k,v| x += "#{k}   " }; puts x
    pf = get
    puts "\n Are you sure? (y)es  (n)o"
    a = get
    case a
      when 'y' then $client.close_portfolio(pf); client_menu
      when 'n' then client_menu
      else puts 'That is not a valid response'; client_menu
    end
  else
    puts "You do not have any portfolios."; gets
    client_menu
  end
end

def open_account
  puts `clear`
  puts titlr('  New Client Application  ')
  print 'Name:  '; name = get
  print 'Age:  '; age = get.to_i

  if age < 18
    p 'Sorry, but you must at least 18 years old to open an account.'; gets
    return; menu
  end

  print 'Address: '; address = get
  print 'Initial deposit: '; balance = get.to_f

  if balance < 10000
    p 'Sorry, but your initial deposit must be at least 10,000.00 .'; gets
    return; menu
  end

  print 'What would you like to name your first portfolio?   '; pf_name = get
  print 'Choose a username:  '; username = get
  print 'Enter your password '; password = get
  client = Client.new(name, age, address, balance, username, password)
  pf = Portfolio.new(pf_name)
  client.portfolios[pf_name] = pf
  $firm.new_client(client, username, password)
  print "\nYour account is all set-up!"; gets
  $client = $firm.clients[username]
  $folios = $client.portfolios
  client_menu
end

def close_account
  puts `clear`
  puts 'Are you sure you want to close your account? (1) yes   (2) no'
  answer = get.to_i
  case answer
    when 1
      $firm.clients.delete($client.username)
      puts "Your account has been closed. You will recieve a check for $#{$client.balance}"
      puts  "in 4-5 business days. Thank you for choosing #{$firm.name}."
      gets
    when 2 then client_menu
    else puts "That is not a valid response."; client_menu
  end
end

def buy_stock
  puts `clear`
  puts titlr(' Stock Purchase ')
  puts titlr('** Hot Stocks **')
  puts "|   ORCL     AAPL     GOOG     JPM     C   |\n"
  puts "\nCurrent Balance: #{$client.balance.round(2)}"
  print "\nWhat stock would you like to buy?   "
  stock = get_stock(get.upcase)
  puts "\nThe current market price for #{stock.symbol} is #{stock.lastTrade}"
  print 'How many shares would you like to purchase?  '
  quantity = gets.to_i
  total = stock.lastTrade * quantity;
  if !(quantity > 0)
    print "You have entered zero shares."; gets
  elsif total <= $client.balance
    puts "\nWhich portfolio would you like to put it in?"
    x = ''; $folios.each { |k,v| x += "#{k}   " }; puts x
    pf = $folios[get]
    if pf.stocks.keys.include? stock.symbol
      pf.increase_position(stock.symbol, quantity, total)
    else
      pf.buy_stock(quantity, Stock.new(stock))
    end
      $firm.take_fee(stock.symbol, $client.name, total)
      $client.buy(total, stock.symbol)
      puts "\nYou have just purchased #{quantity} shares of #{stock.symbol} at #{stock.lastTrade}."
      puts "Your balance is now #{$client.balance.round(2)}."
  else
    print "\nYou do not have enough funds to make this purchase."
  end
  gets; client_menu
end

def sell_stock
  puts `clear`
  puts titlr('  Stock Sale  ')
  past_balance = $client.balance
  puts 'From which portfolio would you like to sell?  '
  print_each $folios
  pf = $folios[get]
  print 'Which stock would you like to sell?   '
  print_each pf.stocks
  stock = pf.stocks[get]
  origin_value = stock[0]
  purchase_price = stock[1].price
  current_price = stock[1].current_price
  diff = (purchase_price - current_price).abs
  puts "\nPaid: #{purchase_price}"
  puts "Market Price: #{current_price}"
  print "\nYou own #{origin_value} shares. How many would you like to sell?  "
  quantity = get.to_i
  if quantity <= origin_value
    $client.balance += current_price * quantity
    pf.sell_stock(stock[1].symbol, quantity)
    puts "\nYou have just sold #{quantity} shares of #{stock[1].symbol}."
    x = current_price > purchase_price ? 'Lost' : 'Gained'
    pf.stocks.delete(stock[1].symbol) if quantity == origin_value
    puts "#{x}: #{diff}"
    puts "New Balance: #{$client.balance.round(2)}.";gets
    client_menu
  else
    print "\nYou do not have that many shares."; gets
    client_menu
  end
end

def move_stock
  puts `clear`
  puts "\nWhat portfolio would you like to move stock from?"
  print_each $folios
  pf1 = $folios[get]
  puts "\nWhich stock would you like to move?"
  print_each pf1.stocks
  stock = pf1.stocks[get]
  puts "\nWhich portfolio would like to move the stock into?"
  print_each $folios
  pf2 = $folios[get]
  puts "\nAre you sure? (y)es  (n)o"
  a = get
  case a
    when 'y'
      pf1.stocks.delete(stock[1].symbol)
      pf2.buy_stock(stock[0], stock[1])
      print "\n#{stock[1].symbol} has been moved from #{pf1.name} to #{pf2.name}"
      gets; client_menu
    when 'n' then client_menu
    else 'That is not a valid response.'; gets
  end
end
