import { existsSync, readFileSync, unlinkSync } from "fs";
import { join } from "path";
import { HERMES_HOME } from "./installer";
import { safeWriteFile } from "./utils";
import Database from "better-sqlite3";
import { t } from "../shared/i18n";
import { getAppLocale } from "./locale";

const CACHE_DIR = join(HERMES_HOME, "desktop");
const CACHE_FILE = join(CACHE_DIR, "sessions.json");
const DB_PATH = join(HERMES_HOME, "state.db");
const WEBUI_SESSIONS_DIR = join(HERMES_HOME, "webui", "sessions");
const INDEX_FILE = join(WEBUI_SESSIONS_DIR, "_index.json");

export interface CachedSession {
  id: string;
  title: string;
  startedAt: number;
  source: string;
  messageCount: number;
  model: string;
}

interface CacheData {
  sessions: CachedSession[];
  lastSync: number;
}

// Generate a short, readable title from the first user message (like ChatGPT/Claude)
function generateTitle(message: string): string {
  if (!message || !message.trim())
    return t("sessions.newConversation", getAppLocale());

  // Clean up the message
  let text = message.trim();

  // Remove markdown formatting
  text = text.replace(/[#*_`~\[\]()]/g, "");
  // Remove URLs
  text = text.replace(/https?:\/\/\S+/g, "");
  // Remove extra whitespace
  text = text.replace(/\s+/g, " ").trim();

  if (!text) return t("sessions.newConversation", getAppLocale());

  // If short enough, use as-is
  if (text.length <= 50) return text;

  // Take first meaningful chunk — aim for ~40-50 chars at word boundary
  const words = text.split(" ");
  let title = "";
  for (const word of words) {
    if ((title + " " + word).trim().length > 45) break;
    title = (title + " " + word).trim();
  }

  return title || text.slice(0, 45) + "...";
}

function readCache(): CacheData {
  try {
    if (!existsSync(CACHE_FILE)) return { sessions: [], lastSync: 0 };
    return JSON.parse(readFileSync(CACHE_FILE, "utf-8"));
  } catch {
    return { sessions: [], lastSync: 0 };
  }
}

function writeCache(data: CacheData): void {
  try {
    safeWriteFile(CACHE_FILE, JSON.stringify(data));
  } catch {
    // non-fatal
  }
}

function getDb(): Database.Database | null {
  if (!existsSync(DB_PATH)) return null;
  return new Database(DB_PATH, { readonly: true });
}

// Sync from hermes DB to local cache — only fetches new/updated sessions
export function syncSessionCache(): CachedSession[] {
  const cache = readCache();
  const db = getDb();
  if (!db) return cache.sessions;

  try {
    // Fetch sessions newer than last sync, or all if first sync
    const rows = db
      .prepare(
        `SELECT s.id, s.started_at, s.source, s.message_count, s.model, s.title
         FROM sessions s
         WHERE s.started_at > ?
         ORDER BY s.started_at DESC`,
      )
      .all(cache.lastSync > 0 ? cache.lastSync - 300 : 0) as Array<{
      id: string;
      started_at: number;
      source: string;
      message_count: number;
      model: string;
      title: string | null;
    }>;

    // Index existing sessions by id once so the per-row update below is
    // O(1) instead of O(N). Without this, syncing N existing sessions
    // against N new rows is O(N²) and visibly slows app startup once a
    // user has accumulated thousands of sessions (issue #16).
    const existingById = new Map<string, CachedSession>();
    for (const s of cache.sessions) existingById.set(s.id, s);
    const newSessions: CachedSession[] = [];

    for (const row of rows) {
      const existing = existingById.get(row.id);
      if (existing) {
        // Update existing entry (message count may have changed)
        existing.messageCount = row.message_count;
        continue;
      }

      // Generate title from first user message
      let title = row.title || "";
      if (!title) {
        try {
          const msg = db
            .prepare(
              `SELECT content FROM messages
               WHERE session_id = ? AND role = 'user' AND content IS NOT NULL
               ORDER BY timestamp, id LIMIT 1`,
            )
            .get(row.id) as { content: string } | undefined;
          title = msg
            ? generateTitle(msg.content)
            : t("sessions.newConversation", getAppLocale());
        } catch {
          title = t("sessions.newConversation", getAppLocale());
        }
      }

      newSessions.push({
        id: row.id,
        title,
        startedAt: row.started_at,
        source: row.source,
        messageCount: row.message_count,
        model: row.model || "",
      });
    }

    // Merge: new sessions first (most recent), then existing
    const allSessions = [...newSessions, ...cache.sessions];
    // Sort by startedAt descending
    allSessions.sort((a, b) => b.startedAt - a.startedAt);

    const updated: CacheData = {
      sessions: allSessions,
      lastSync: Math.floor(Date.now() / 1000),
    };
    writeCache(updated);
    return updated.sessions;
  } catch {
    return cache.sessions;
  } finally {
    db.close();
  }
}

// Fast read from cache only (no DB access)
export function listCachedSessions(
  limit = 50,
  offset = 0,
): CachedSession[] {
  const cache = readCache();
  return cache.sessions.slice(offset, offset + limit);
}

// Update title for a specific session
export function updateSessionTitle(
  sessionId: string,
  title: string,
): void {
  const cache = readCache();
  const idx = cache.sessions.findIndex((s) => s.id === sessionId);
  if (idx >= 0) {
    cache.sessions[idx].title = title;
    writeCache(cache);
  }
}

export function removeSessionFromCache(sessionId: string): void {
  const cache = readCache();
  const filtered = cache.sessions.filter((s) => s.id !== sessionId);
  if (filtered.length !== cache.sessions.length) {
    cache.sessions = filtered;
    writeCache(cache);
  }
}

export function deleteSessionComplete(sessionId: string): boolean {
  let deleted = false;

  try {
    if (existsSync(WEBUI_SESSIONS_DIR)) {
      const sessionFile = join(WEBUI_SESSIONS_DIR, `${sessionId}.json`);
      if (existsSync(sessionFile)) {
        unlinkSync(sessionFile);
        deleted = true;
      }
      if (existsSync(INDEX_FILE)) {
        const indexContent = readFileSync(INDEX_FILE, "utf-8");
        const index = JSON.parse(indexContent) as Array<{ session_id: string }>;
        const filtered = index.filter((item) => item.session_id !== sessionId);
        if (filtered.length !== index.length) {
          safeWriteFile(INDEX_FILE, JSON.stringify(filtered, null, 2));
          deleted = true;
        }
      }
    }
  } catch {
    // filesystem deletion is best-effort
  }

  try {
    if (existsSync(DB_PATH)) {
      const db = new Database(DB_PATH);
      try {
        db.pragma("foreign_keys = ON");
        const tx = db.transaction(() => {
          db.prepare("DELETE FROM messages WHERE session_id = ?").run(sessionId);
          db.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
        });
        tx();
        deleted = true;
      } finally {
        db.close();
      }
    }
  } catch {
    // database deletion is best-effort
  }

  removeSessionFromCache(sessionId);

  return deleted;
}
