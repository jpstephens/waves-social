import Image from "next/image";
import { SignUp } from "@clerk/nextjs";

export default function Page() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-navy-950 bg-radial-cyan p-6">
      <div className="text-center mb-10">
        <Image
          src="/waves-logo.png"
          alt="Waves"
          width={112}
          height={112}
          className="logo-glow mx-auto mb-4"
        />
        <h1 className="font-heading text-5xl text-white tracking-tighter">
          WAVES 8U
        </h1>
        <p className="text-cyan-400 uppercase tracking-[0.3em] text-xs font-bold mt-2">
          Press Box
        </p>
      </div>
      <SignUp />
    </div>
  );
}
