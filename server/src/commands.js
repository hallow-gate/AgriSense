import { db } from './db.js';

// Commands not picked up within 10 minutes are dropped so a stale "water" never fires later.
export const expireCommands = () => db.from('commands').update({ status: 'expired' })
  .in('status', ['pending', 'sent']).lt('created_at', new Date(Date.now() - 600_000).toISOString());
