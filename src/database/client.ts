import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { env } from '@/config/env';

// Initialize the PostgreSQL connection pool
const pool = new Pool({
  connectionString: env.DATABASE_URL,
});

// Initialize the Prisma PostgreSQL driver adapter
const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({
  adapter,
  log: [
    { emit: 'event', level: 'query' },
    { emit: 'stdout', level: 'info' },
    { emit: 'stdout', level: 'warn' },
    { emit: 'stdout', level: 'error' },
  ],
});

// Log queries in debug mode for development
prisma.$on('query' as any, (e: any) => {
  // logger.debug(`Prisma Query: ${e.query} | Params: ${e.params} | Duration: ${e.duration}ms`);
});
