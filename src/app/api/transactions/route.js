// app/api/transactions/route.js

import prisma  from "@/lib/prisma";


export default async function handler(req, res) {
  const transactions = await prisma.transaction.findMany();
  res.status(200).json(transactions);
}
