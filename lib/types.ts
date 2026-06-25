// Shared domain types, mirroring the Supabase schema.

export type ReadStatus = "to-read" | "currently-reading" | "read" | "did-not-finish";

export interface Profile {
  id: string;
  display_name: string | null;
  theme: string;
  streak: number;
}

export interface Challenge {
  id: string;
  user_id: string;
  template_key: string | null;
  name: string;
  tag: string;
  start_date: string;
  end_date: string;
  max_per_book: number;
  unit: string;
  archived: boolean;
}

export interface Square {
  id: string;
  challenge_id: string;
  key: string;
  name: string;
  position: number;
  need: number;
  rule: string;
}

export interface Book {
  id: string;
  user_id: string;
  title: string;
  author: string | null;
  isbn: string | null;
  format: string | null;
  pages: number | null;
  star_rating: number | null;
  read_status: ReadStatus;
  date_read: string | null;
  publish_year: number | null;
  cover_g1: string;
  cover_g2: string;
  source: string;
  tags: string | null;
}

export interface BookSquare {
  id: string;
  book_id: string;
  challenge_id: string;
  square_id: string;
  why: string | null;
  status: "planned" | "logged";
}

// A square enriched with progress derived from its assigned books' read status.
export interface SquareProgress extends Square {
  logged: number; // books assigned to this square that are 'read'
  state: "empty" | "options" | "progress" | "done";
}

export interface ChallengeWithSquares extends Challenge {
  squares: SquareProgress[];
  done: number; // squares completed
  total: number; // total squares
}
