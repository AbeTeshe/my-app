import { prisma } from "./prisma.config.js";

async function main() {
  const tx = await prisma.transaction.findMany();
  console.log("Transactions:", tx);
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
