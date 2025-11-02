import { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

export default function Go() {
  const [params] = useSearchParams();
  const raw = params.get("u") || "";

  const url = useMemo(() => {
    try {
      const decoded = decodeURIComponent(raw);
      // Allow only safe, expected schemes/hosts
      if (
        decoded.startsWith("https://wa.me/") ||
        decoded.startsWith("mailto:")
      ) {
        return decoded;
      }
    } catch (_) {}
    return "";
  }, [raw]);

  useEffect(() => {
    if (url) {
      // Top-level navigation to avoid iframe/COOP issues
      window.location.replace(url);
    }
  }, [url]);

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <article className="text-center space-y-3">
        <h1 className="text-2xl font-semibold">Redirecting…</h1>
        {!url ? (
          <p className="text-muted-foreground text-sm">
            Invalid or unsupported destination.
          </p>
        ) : (
          <p className="text-muted-foreground text-sm">
            If you are not redirected automatically,
            {" "}
            <a href={url} rel="noopener" className="underline">
              click here
            </a>.
          </p>
        )}
      </article>
    </main>
  );
}
