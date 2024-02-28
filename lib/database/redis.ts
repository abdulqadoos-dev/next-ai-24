import { createClient } from 'redis';

export const Client = createClient({
    url: process.env.REDIS_URL
});

export async function connect() {
  if (!Client.isOpen) {
      await Client.connect();
  }
}