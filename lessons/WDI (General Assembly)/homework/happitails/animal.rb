class Animal
  attr_accessor :name, :breed, :age, :gender, :toys

  def initialize(o=[])
    @name = o[:name]
    @breed = o[:breed]
    @age = o[:age]
    @gender = o[:gender]
    @toys = o[:toys] || []
    $shelter.animals[name] = [@breed, @age, @gender, @toys]
  end

end