export default function AppLoading() {
  return (
    <div className="mx-auto grid w-full max-w-[1440px] gap-4">
      <div className="h-10 w-64 animate-pulse rounded-xl bg-muted/60" />
      <div className="h-14 animate-pulse rounded-xl bg-muted/60" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-32 animate-pulse rounded-xl bg-muted/60" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="h-64 animate-pulse rounded-xl bg-muted/60 xl:col-span-2" />
        <div className="h-64 animate-pulse rounded-xl bg-muted/60" />
      </div>
    </div>
  );
}
