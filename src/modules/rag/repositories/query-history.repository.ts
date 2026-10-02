import { prisma } from '@/database/client';

export interface ISaveQueryHistoryInput {
  userId: string;
  documentId?: string | null;
  question: string;
  answer: string;
}

export interface IQueryHistoryFilter {
  documentId?: string;
  page?: number;
  limit?: number;
}

async function create(data: ISaveQueryHistoryInput) {
  return await prisma.queryHistory.create({
    data: {
      userId: data.userId,
      documentId: data.documentId || null,
      question: data.question,
      answer: data.answer,
    },
  });
}

async function findByUser(userId: string, filter: IQueryHistoryFilter = {}) {
  const page = filter.page && filter.page > 0 ? filter.page : 1;
  const limit = filter.limit && filter.limit > 0 ? filter.limit : 20;
  const skip = (page - 1) * limit;

  const where: any = {
    userId,
    documentId: filter.documentId ? filter.documentId : null,
  };

  const [items, total] = await Promise.all([
    prisma.queryHistory.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.queryHistory.count({ where }),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      total_pages: Math.ceil(total / limit) || 1,
    },
  };
}

export default {
  create,
  findByUser,
};
