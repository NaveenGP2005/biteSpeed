import { query } from '../database/connection';
import { Contact, IdentifyRequest, ContactResponse } from '../types/contact';

class ContactService {
  /**
   * Find all contacts linked to a primary contact
   */
  async findLinkedContacts(primaryId: number): Promise<Contact[]> {
    const result = await query(
      `SELECT * FROM contact WHERE "linkedId" = $1 OR id = $1 ORDER BY "createdAt" ASC`,
      [primaryId]
    );
    return result.rows;
  }

  /**
   * Find contact by email or phone number
   */
  async findContactByEmailOrPhone(
    email?: string,
    phoneNumber?: string
  ): Promise<Contact[]> {
    let queryText = 'SELECT * FROM contact WHERE "deletedAt" IS NULL AND (';
    const params: any[] = [];

    if (email) {
      queryText += `email = $${params.length + 1}`;
      params.push(email);
    }

    if (email && phoneNumber) {
      queryText += ' OR ';
    }

    if (phoneNumber) {
      queryText += `"phoneNumber" = $${params.length + 1}`;
      params.push(phoneNumber);
    }

    queryText += ') ORDER BY "createdAt" ASC';

    const result = await query(queryText, params);
    return result.rows;
  }

  /**
   * Get primary contact from a list of contacts
   */
  getPrimaryContact(contacts: Contact[]): Contact {
    return contacts.find((c) => c.linkPrecedence === 'primary') || contacts[0];
  }

  /**
   * Consolidate contacts and return response
   */
  async consolidateContacts(primaryId: number): Promise<ContactResponse> {
    const allContacts = await this.findLinkedContacts(primaryId);

    const emails = new Map<string, boolean>();
    const phoneNumbers = new Map<string, boolean>();
    const secondaryContactIds: number[] = [];

    for (const contact of allContacts) {
      if (contact.email) {
        emails.set(contact.email, true);
      }
      if (contact.phoneNumber) {
        phoneNumbers.set(contact.phoneNumber, true);
      }
      if (contact.linkPrecedence === 'secondary') {
        secondaryContactIds.push(contact.id);
      }
    }

    // Get primary contact's email and phone as first elements
    const primaryContact = this.getPrimaryContact(allContacts);
    const emailsList = primaryContact.email
      ? [primaryContact.email, ...Array.from(emails.keys()).filter((e) => e !== primaryContact.email)]
      : Array.from(emails.keys());

    const phoneNumbersList = primaryContact.phoneNumber
      ? [primaryContact.phoneNumber, ...Array.from(phoneNumbers.keys()).filter((p) => p !== primaryContact.phoneNumber)]
      : Array.from(phoneNumbers.keys());

    return {
      primaryContactId: primaryId,
      emails: emailsList,
      phoneNumbers: phoneNumbersList,
      secondaryContactIds,
    };
  }

  /**
   * Create a new contact
   */
  async createContact(
    email: string | null,
    phoneNumber: string | null,
    linkedId: number | null = null,
    linkPrecedence: 'primary' | 'secondary' = 'primary'
  ): Promise<Contact> {
    const result = await query(
      `INSERT INTO contact (email, "phoneNumber", "linkedId", "linkPrecedence", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING *`,
      [email, phoneNumber, linkedId, linkPrecedence]
    );
    return result.rows[0];
  }

  /**
   * Update contact's linkedId and linkPrecedence
   */
  async updateContact(
    id: number,
    linkedId: number | null,
    linkPrecedence: 'primary' | 'secondary'
  ): Promise<Contact> {
    const result = await query(
      `UPDATE contact SET "linkedId" = $1, "linkPrecedence" = $2, "updatedAt" = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [linkedId, linkPrecedence, id]
    );
    return result.rows[0];
  }

  /**
   * Main identify logic
   */
  async identify(request: IdentifyRequest): Promise<ContactResponse> {
    const { email, phoneNumber } = request;

    // Validate that at least one field is provided
    if (!email && !phoneNumber) {
      throw new Error('Either email or phoneNumber must be provided');
    }

    // Find existing contacts matching email or phone
    const existingContacts = await this.findContactByEmailOrPhone(email, phoneNumber);

    // Case 1: No existing contacts - create new primary contact
    if (existingContacts.length === 0) {
      const newContact = await this.createContact(email || null, phoneNumber || null);
      return this.consolidateContacts(newContact.id);
    }

    // Get all primary contacts in the results
    const primaryContacts = existingContacts.filter((c) => c.linkPrecedence === 'primary');

    // Case 2: Single primary contact exists
    if (primaryContacts.length === 1) {
      const primaryId = primaryContacts[0].id;

      // Check if request data is already in the linked group
      const allLinkedContacts = await this.findLinkedContacts(primaryId);
      const dataExists = allLinkedContacts.some(
        (c) => (email && c.email === email) || (phoneNumber && c.phoneNumber === phoneNumber)
      );

      // If request contains new data, create secondary contact
      if (!dataExists && (email !== primaryContacts[0].email || phoneNumber !== primaryContacts[0].phoneNumber)) {
        await this.createContact(email || null, phoneNumber || null, primaryId, 'secondary');
      }

      return this.consolidateContacts(primaryId);
    }

    // Case 3: Multiple primary contacts - need to merge them
    // Keep the oldest as primary, convert others to secondary
    const sortedPrimaries = primaryContacts.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    const newestPrimary = sortedPrimaries[sortedPrimaries.length - 1];
    const oldestPrimary = sortedPrimaries[0];

    // Update the newer primary to be secondary to the older one
    await this.updateContact(newestPrimary.id, oldestPrimary.id, 'secondary');

    // Update all secondary contacts that pointed to the new primary to point to the old primary
    await query(
      `UPDATE contact SET "linkedId" = $1 WHERE "linkedId" = $2`,
      [oldestPrimary.id, newestPrimary.id]
    );

    // Check if new data needs to be added
    const allLinkedContacts = await this.findLinkedContacts(oldestPrimary.id);
    const dataExists = allLinkedContacts.some(
      (c) => (email && c.email === email) || (phoneNumber && c.phoneNumber === phoneNumber)
    );

    if (!dataExists) {
      await this.createContact(email || null, phoneNumber || null, oldestPrimary.id, 'secondary');
    }

    return this.consolidateContacts(oldestPrimary.id);
  }
}

export default new ContactService();
