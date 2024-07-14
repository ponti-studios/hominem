$firm = Firm.new('Un-Fidelity Investments')

c1 = Client.new('Charles Ponti', 27, '18 High Street', 100000, 'cjponti', 'fluffy')
c2 = Client.new('Sally Jones', 23, '1 Main Street', 200000, 'sallyj', 'kittens')
c3 = Client.new('John Smith', 55, '12 Archer Lane', 500000, 'johnj', 'oldman')

[c1, c2, c3].each do |c|
  c.portfolios['Tech'] = Portfolio.new('Tech')
  c.portfolios['Finance'] = Portfolio.new('Finance')
  $firm.new_client(c, c.username, c.password)
    ['GOOG','AAPL'].each do |s|
        stock = get_stock(s); total = stock.lastTrade * 10
        c.balance -= total; s1 = Stock.new(stock)
        c.portfolios['Tech'].buy_stock(10, s1)
    end
    ['JPM','C'].each do |s|
        stock = get_stock(s); total = stock.lastTrade * 20
        c.balance -= total; s1 = Stock.new(stock)
        c.portfolios['Finance'].buy_stock(20, s1)
    end
end