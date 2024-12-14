export type Person = {
  id: number;
  name: string;
  email: string;
  phone: string;
}

export type People = Person[];

/**
 * A note associated with a person.
 * 
 * This enables users to add notes about people in their lives, including feelings, thoughts, and other information.
 */
export type PeopleNote = {
  id: number;
  person_id: number;
  note: string;
  type: 'feeling' | 'thought' | 'other';
}
