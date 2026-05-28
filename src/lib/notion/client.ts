import { Client } from "@notionhq/client"

let _client: Client | null = null

/**
 * Returns a singleton Notion client.
 * Requires NOTION_TOKEN in the environment.
 */
export function getNotionClient(): Client {
  if (_client) return _client

  const token = import.meta.env.NOTION_TOKEN
  if (!token) throw new Error("NOTION_TOKEN is not set")

  _client = new Client({ auth: token })
  return _client
}