class Shelter
  attr_accessor :name, :animals, :clients

  def initialize(name)
    @name = name
    @animals = {}
    @clients = {}
  end

  def display_clients
    puts `clear`
    @clients.each do |k,v|
      puts "#{k}: \nAge: #{v[0]}, Gender: #{v[1]}, Kids: #{v[2]}, Number of pets: #{v[3]}\n"
    end
  end

  def display_animals
    puts `clear`
    @animals.each do |k,v|
      puts "#{k}: \nBreed: #{v[0]}, Age: #{v[1]}, Gender: #{v[2]}, Favorite Toys: #{v[3]}\n"
    end
  end

end