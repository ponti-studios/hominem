class Client
  attr_accessor :name, :age, :address, :balance, :portfolios
  attr_accessor :username, :password, :fees

  def initialize(name, age, address, balance,username, password)
    @name, @age, @address, @balance = name, age, address, balance.round(2)
    @username, @password = username, password
    @fees = [0, []]
    @portfolios = {}
  end

  def net_worth
    total = balance
    @portfolios.values.each do |p|
       total += p.value
     end
     total
  end

  def close_portfolio(name)
    @portfolios[name].stocks.values.each do |s|
       @balance += s[0] * s[1].price
       @portfolios[name].stocks.delete(s[1].symbol)
    end
    @portfolios.delete(name)
  end

  def buy(total, symbol)
    @fees[0] += 7
    @fees[1] << {date: DateTime.now, stock: symbol, sale: total, fee: 7}
    @balance -= ( total + 7 )
  end

end