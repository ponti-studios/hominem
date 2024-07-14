# Function definitions first
def menu
    # Clear the screen, and present the user with a menu
    puts `clear`
    puts "***CalcIt***"
    puts "(b)asic, (a)dvanced, (t)rip calculator"
    puts "(m)ortgage calculator, (bmi) calculator"
    print "or (q)uit: "
    gets.chomp.downcase
end

def error
  puts  "You did not enter an appropriate choice, you wanker."
end

def check x
  if x.to_i == 0
    puts "0 is not a valid input"
    return
  end
end

def gettr
  gets.chomp.to_f
end
#based on user selection run appropriate functionality
def basic_calc
    # ask the user which operation they want to perform
    print "(a)dd, (s)ubtract, (m)ultiply, (d)ivide: "
    operation = gets.chomp.downcase

    if ['a','s','m','d'].include? operation
        print "Type first number:  "
        first = gettr

        print "Type second number:  "
        second = gettr

        case operation
          when "a" then p first + second
          when "s" then p first - second
          when "m" then p first * second
          when "d" then p (first / second).round(2)
        end
        gets
    else
        error
        gets
    end
end

def advanced_calc
  # ask the user which operation they want to perform
  print "(p)ower, (s)quare root: "
  operation = gets.chomp.downcase

  if ['p','s'].include? operation
      print "enter first number "
      first = gettr

      if operation == "s"
        p Math.sqrt(first)
      elsif operation == 'p'
        print "enter second number "
        second = gettr
        p first**second
      end
  else
      error
  end
  gets
end

def trip_calc
  puts `clear`
  puts "Welcome to the Trip Calculator"

  print "How many miles will you be driving?  "
  distance = gettr
  print "How many miles per gallon does your car get?  "
  mpg = gettr
  print "How much does gas cost per gallon (in dollars)?  "
  price = gettr
  print "How fast will you drive?  "
  speed = gettr

  if speed > 60
    diff = speed - 60
    mpg -= ( diff * 2 )
    puts "\nBy exceeding the speed limit, you've reduced your mpg to #{mpg}"
  else
    puts "\nThank you for following the speed limit."
  end

  time = (distance / speed).round(1)
  cost = ( (distance / mpg) * price ).round(2)

  puts "Your trip will take #{time} hours and cost $#{cost}"

  gets
end

def bmi_calc
  puts `clear`
  puts "Welcome to the BMI Calculator"

  print "\nWould you like to use (p)ounds & inches or (k)gs & centimeters? "
  metric = gets.chomp

  if !(['p','k'].include? metric)
    error
    gets
    return
  end

  print "How much do you weigh? "
  weight = gettr
  print "How tall are you? "
  height = gettr

  if metric == 'p'
    result = (weight * 703)/(height**2)
  elsif metric == 'k'
    result = (weight/(height**2))*10000
  end

  puts "\nYour BMI is #{result.round(2)}"
  gets
end

def mortgage_calc
  puts `clear`
  puts "Welcome to the Mortgage Calculator"

  print "\nWhat is your principal?  "
  principal = gettr
  print "What is your interest rate?  "
  rate = gettr
  print "How many years is your loan term?  "
  term = gettr

  rate = (rate/12)/100
  term = term*12
  result = ((principal*rate)*((1 + rate)**term))/(((1+rate)**term) - 1)
  result = result.to_f.round(2)

  puts "\nYour monthly mortgage payment will be $#{result}"
  gets
end

# run the app...
response = menu
while response != 'q'
  case response
    when 'b' then basic_calc
    when 'a' then advanced_calc
    when 't' then trip_calc
    when 'bmi' then bmi_calc
    when 'm' then mortgage_calc
    else
      error
      gets
  end
  response = menu
end