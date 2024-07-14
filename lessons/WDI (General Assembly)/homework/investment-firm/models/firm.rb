class Firm

  attr_accessor :name, :clients, :logins, :master

  def initialize(name)
    @name = name
    @master = 1000000
    @fees = []
    @clients = {}
    @logins = {}
  end

  def new_client(client, username, password)
    @clients[username] = client
    @logins[username] = password
  end

  def take_fee(symbol, client, total)
    @master += 7
    @fees << {date: DateTime.now, client: client, stock: symbol, sale: total, fee: 7}
  end
end