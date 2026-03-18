export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center px-8">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold text-foreground">Reference examples only</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          The previous landing page showcase has been moved into
          `components/examples/main-page-example.tsx` for LLM prompting and reuse.
        </p>
      </div>
    </main>
  );
}
