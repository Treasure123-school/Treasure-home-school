import { z } from "zod";

export interface SchoolPhone {
  countryCode: string;
  number: string;
}

export interface ContactSettings {
  schoolPhones: string | SchoolPhone[]; // Can be JSON string or parsed array
  schoolEmails: string | string[];     // Can be JSON string or parsed array
}

/**
 * Utility class for consistent contact information retrieval across the application.
 * Ensures the Super Admin settings remain the single source of truth.
 */
export class ContactUtils {
  /**
   * Parses the school phones from the settings.
   */
  static getPhones(settings?: ContactSettings): SchoolPhone[] {
    if (!settings?.schoolPhones) return [];
    try {
      const phones = typeof settings.schoolPhones === 'string' 
        ? JSON.parse(settings.schoolPhones) 
        : settings.schoolPhones;
      return Array.isArray(phones) ? phones : [];
    } catch (e) {
      console.error("Error parsing school phones:", e);
      return [];
    }
  }

  /**
   * Returns the primary (first) school phone object.
   */
  static getPrimaryPhone(settings?: ContactSettings): SchoolPhone | null {
    const phones = this.getPhones(settings);
    return phones.length > 0 ? phones[0] : null;
  }

  /**
   * Returns the primary school phone formatted as a string.
   */
  static getFormattedPrimaryPhone(settings?: ContactSettings): string {
    const phone = this.getPrimaryPhone(settings);
    if (!phone) return "";
    return `${phone.countryCode}${phone.number}`;
  }

  /**
   * Parses the school emails from the settings.
   */
  static getEmails(settings?: ContactSettings): string[] {
    if (!settings?.schoolEmails) return [];
    try {
      const emails = typeof settings.schoolEmails === 'string' 
        ? JSON.parse(settings.schoolEmails) 
        : settings.schoolEmails;
      return Array.isArray(emails) ? emails : [];
    } catch (e) {
      console.error("Error parsing school emails:", e);
      return [];
    }
  }

  /**
   * Returns the primary (first) school email.
   */
  static getPrimaryEmail(settings?: ContactSettings): string {
    const emails = this.getEmails(settings);
    return emails.length > 0 ? emails[0] : "";
  }
}
