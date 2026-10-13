const EMAIL = /[^\s@()<>]+@[^\s@()<>]+\.[^\s@()<>]+/g;

/**
 * Masks every email address in a label: "dev@acme.io" -> "d•••@a•••.io". The bullet count is
 * fixed so the address length doesn't leak. Text without an address comes back unchanged.
 */
export function maskEmails(text: string): string {
  return text.replace(EMAIL, (email) => {
    const at = email.lastIndexOf("@");
    const domain = email.slice(at + 1);
    return `${email[0]}•••@${domain[0]}•••${domain.slice(domain.lastIndexOf("."))}`;
  });
}
