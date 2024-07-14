require 'pry'

require_relative 'shelter'
require_relative 'client'
require_relative 'animal'

# Shelter
$shelter = Shelter.new('Wizz Bang Animal Shelter')
# Clients
Client.new('Dave',27,'male',['Julie','James','Henry'], 3)
Client.new('Sally',23,'female',['Sam','Mikey'],1)
Client.new('Anna',30,'female',['Charlotte','Charles'],1)
# Animals
Animal.new({name: 'Woofy', breed: 'Pug', age: 2, gender: 'male', toys: ['bone', 'ball']})
Animal.new({name: 'Fluffy', breed: 'Shih Tzu', age: 1, gender: 'female', toys: ['rope', 'tennis ball']})
Animal.new({name: 'Growler', breed: 'Rottweiler', age: 7, gender: 'male', toys: ['flamethrower', 'chainsaw']})


def menu
  puts `clear`
  puts "Welcome to the #{$shelter.name}\n"
  puts '(1) List Animals'
  puts '(2) Adopt an Animal'
  puts '(3) Give up a pet for Adoption'
  puts '(4) List Clients'
  puts '(5) Sign Up'
  puts '(6) Exit'
  gets.chomp.to_i
end

def create_pet
  puts `clear`
  print "What's your name?  "
  client = gets.chomp.capitalize
  if !($shelter.clients.include? client)
    print "Sorry, but you are not a client.\n"
    gets
    sign_up
  else
    $shelter.clients[client][3] -= 1
    puts "What is your pet's name?"
    name = gets.chomp.capitalize
    puts "What is it's breed?"
    breed = gets.chomp
    puts "What is it's age? "
    age = gets.chomp.to_i
    puts "What gender is it?"
    gender = gets.chomp
    puts "What are it's favorite toys?"
    toys = gets.chomp.split
    Animal.new({name: name, breed: breed, age: age, gender: gender, toys: toys})
    p 'Thank you for your donation. Have a woof-tastic day!'
    gets
  end
end

def sign_up
    puts `clear`
    puts "What is your name?"
    name = gets.chomp.capitalize
    puts "How old are you?"
    age = gets.chomp.to_i
    puts "What is your gender? "
    gender = gets.chomp
    puts "Do you have children? (y)es  (n)o "
    a = gets.chomp
    if a == 'y'
      puts 'What are their names?'
      kids = gets.chomp.split
    end
    puts "Do you have any pets?"
    a = gets.chomp
    if a == 'y'
      puts "How many do you have?"
      num_pets = gets.chomp.to_i
    end
    Client.new(name,age,gender,kids,num_pets)
    p "Thank you for signing up, #{name}"
    gets
end

def adopt_pet
  puts `clear`
  puts "Which pet would you like to adopt?\n"
  $shelter.display_animals; puts
  animal = gets.chomp.capitalize
  print "What's your name?  "
  client = gets.chomp.capitalize
  if !($shelter.clients.include? client)
    print "Sorry, but you are not a client. Please sign up first.\n"
    gets
    sign_up
  else
    $shelter.clients[client][3] += 1
    $shelter.animals.delete(animal)
    print "Thank you for adopting #{animal}"
    gets
  end
end

response = menu
while response != 6
  case response
    when 1 then $shelter.display_animals; gets
    when 2 then adopt_pet
    when 3 then create_pet
    when 4 then $shelter.display_clients; gets
    when 5 then sign_up
    when 6 then exit
  end
  response = menu
end
