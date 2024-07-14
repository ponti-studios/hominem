class Stock

  attr_accessor :symbol, :name, :price, :current_price

  def initialize(s={})
    @symbol, @name, @price = s.symbol, s.name, s.lastTrade
  end

  def current_price
    $yf.get_standard_quotes(@symbol)[@symbol].lastTrade
  end

end