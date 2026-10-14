/** A block is a paragraph, or a bulleted list (optionally with a lead-in). */
export type LegalBlock = string | { lead?: string; list: string[] };

export interface LegalSection {
  id: string;
  heading: string;
  blocks: LegalBlock[];
}

export interface LegalDoc {
  title: string;
  /** Short line under the title. */
  summary: string;
  sections: LegalSection[];
}
