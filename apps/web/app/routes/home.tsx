import { redirect } from 'react-router';

// Chat lives in the user's own AI agent over MCP now; tasks is the web home.
export const loader = () => redirect('/tasks');

export default function HomePage() {
  return null;
}
