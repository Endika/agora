/**
 * A proposal being written, kept on the device so the back button and a lock screen stop being
 * destructive. Text only: the picked images hold live Blobs and an object URL, neither of which
 * survives JSON — losing them is the one thing the user has to redo, and the form says so.
 */
export interface StoredDraft {
  title: string
  description: string
  tags: string[]
  deadline: string
  cost: string
}

/** One key per thing being written: a new proposal and each edited one never overwrite each other. */
export function draftKey(slug: string, proposalId?: string): string {
  return proposalId ? `agora:draft:${slug}:${proposalId}` : `agora:draft:${slug}`
}

export function readDraft(key: string): StoredDraft | null {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return null
    const parsed = JSON.parse(raw) as Partial<StoredDraft>
    if (typeof parsed.title !== 'string') return null
    return {
      title: parsed.title,
      description: typeof parsed.description === 'string' ? parsed.description : '',
      tags: Array.isArray(parsed.tags) ? parsed.tags.filter((tag) => typeof tag === 'string') : [],
      deadline: typeof parsed.deadline === 'string' ? parsed.deadline : '',
      cost: typeof parsed.cost === 'string' ? parsed.cost : '',
    }
  } catch {
    return null
  }
}

export function writeDraft(key: string, draft: StoredDraft): void {
  try {
    localStorage.setItem(key, JSON.stringify(draft))
  } catch {
    // A full or blocked store is not worth failing a keystroke over.
  }
}

export function clearDraft(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    // Same.
  }
}
