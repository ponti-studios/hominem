export function maskEmail(email: string) {
  const atIndex = email.indexOf('@');
  if (atIndex <= 0) {
    return email;
  }

  const local = email.slice(0, atIndex);
  const domain = email.slice(atIndex);

  if (local.length <= 2) {
    return `${local[0] ?? ''}***${domain}`;
  }

  return `${local.slice(0, 2)}***${domain}`;
}
