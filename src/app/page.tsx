// import Image from "next/image";
import { prisma } from "@/lib/db";

export default async function Home() {
  const users = await prisma.user.findMany();
  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <div>{JSON.stringify(users, null, 2)}</div>
      <h1 className="text-4xl font-bold">Welcome to Vibe</h1>

      <p className="text-lg text-center">
        This is a simple app to demonstrate the use of Prisma with Next.js.
      </p>
    </div>
  );
}
