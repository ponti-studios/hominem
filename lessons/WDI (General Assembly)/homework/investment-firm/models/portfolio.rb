class Portfolio
  attr_accessor :name, :stocks, :sold, :value

  def initialize(name)
    @name = name
    @value = 0
    @stocks = {}
  end

  def sell_stock(symbol, quantity)
      @stocks[symbol][0] -= quantity
      @value -= quantity * @stocks[symbol][1].price
  end

  def buy_stock(quantity, stock)
    @stocks[stock.symbol] =  [quantity, stock]
    @value += quantity * stock.price
  end

  def increase_position(symbol, quantity, total)
    @stocks[symbol][0] += quantity
    @value += total
  end

end