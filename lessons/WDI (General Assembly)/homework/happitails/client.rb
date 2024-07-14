class Client
  attr_accessor :name, :age, :gender, :kids, :num_pets

  def initialize(name, age, gender, kids, num_pets)
    @name = name
    @age = age
    @gender = gender
    @kids = []
    @num_pets = num_pets
    $shelter.clients[name] = [age, gender, kids, num_pets]
  end

end
