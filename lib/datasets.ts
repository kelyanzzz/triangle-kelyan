// Loads the support-ticket datasets from data/ and samples from them.
// The 100-labelled set carries category/priority (and tags) for accuracy;
// the 500 set is unlabelled.
import fs from "node:fs";
import path from "node:path";

export type Ticket = {
  ticket_id: string;
  subject: string;
  body: string;
  // present only in the labelled set:
  category?: string;
  priority?: string;
  needs_human_review?: boolean;
  tags?: string;
};

export type DatasetName = "labelled100" | "unlabelled500";

const FILES: Record<DatasetName, string> = {
  labelled100: "support_tickets_100_labelled.json",
  unlabelled500: "support_tickets_500.json",
};

function load(dataset: DatasetName): Ticket[] {
  const file = path.join(process.cwd(), "data", FILES[dataset]);
  const raw = fs.readFileSync(file, "utf8");
  return JSON.parse(raw) as Ticket[];
}

// Random sample of `n` tickets (without replacement). n<=0 => all.
export function sampleTickets(dataset: DatasetName, n: number): Ticket[] {
  const all = load(dataset);
  if (n <= 0 || n >= all.length) return all.slice();
  const copy = all.slice();
  // Fisher–Yates partial shuffle
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(Math.random() * (copy.length - i));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

export function datasetSize(dataset: DatasetName): number {
  return load(dataset).length;
}
