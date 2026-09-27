import { getSession } from "@/lib/auth0/session";

export default async function Home() {
  const session = await getSession();

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">
        Countersign — scaffold OK
      </h1>
      <p className="max-w-md text-sm text-zinc-500 dark:text-zinc-400">
        The agent proposes. Policy and people decide. Only the signer can pay.
      </p>
      {session ? (
        <div className="flex flex-col items-center gap-2 text-sm">
          <p>
            Signed in as <span className="font-medium">{session.user.name}</span>
          </p>
          <a href="/auth/logout" className="underline">
            Log out
          </a>
        </div>
      ) : (
        <a href="/auth/login" className="text-sm underline">
          Log in
        </a>
      )}
    </div>
  );
}
