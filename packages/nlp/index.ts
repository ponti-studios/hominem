import * as chrono from 'chrono-node';
import nlp from 'compromise';

interface EventDetails {
  all: string[];
  title: string;
  people: string[];
  place: string;
  date_time: string | null;
}

function parseEventDetails(userInput: string): EventDetails {
  // Parse the input text with compromise
  const doc = nlp(userInput);

  // Initialize default values
  let title = '';
  let place = '';
  let dateTime: string | null = null;

  // Extract possible title
  const titleTokens = doc.match('#Verb+ #Noun+').out('array');
  title = titleTokens.join(' ');

  // Extract place
  const places = doc.places().out('array');
  if (places.length > 0) {
    place = places.join(', ');
  }

  // Extract people
  const people = doc.people().out('array');
  // ! TODO Search user's contacts to find the appropriate people

  // Extract and parse date/time
  const dates = chrono.parse(userInput);
  if (dates.length > 0) {
    dateTime = dates[0].start.date().toISOString();
  }

  return {
    all: doc.all().out('array'),
    title: title || 'No Title Found',
    people,
    place: place || 'No Place Found',
    date_time: dateTime || 'No Date/Time Found',
  };
}

const eventDetails = parseEventDetails(
  'Schedule a meeting with John at Central Park next Tuesday at 3 PM'
);

console.log('Event Details:');
console.log(`all: ${eventDetails.all}`);
console.log(`Title: ${eventDetails.title}`);
console.log(`People: ${eventDetails.people}`);
console.log(`Place: ${eventDetails.place}`);
console.log(`Date and Time: ${eventDetails.date_time}`);
