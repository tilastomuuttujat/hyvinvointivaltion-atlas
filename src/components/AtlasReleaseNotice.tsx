import { useEffect, useState } from "react";
/** Keep the reader's route intact until they explicitly load a newer coherent snapshot. */
export function AtlasReleaseNotice({ generatedAt }: { generatedAt?: string }) {
  const [next, setNext] = useState<string | null>(null);
  useEffect(() => {
    if (!generatedAt) return;
    let cancelled = false;
    const check = async () => {
      try {
        const response = await fetch(
          `${import.meta.env.BASE_URL}data/atlas-version.json`,
          { cache: "no-store" },
        );
        if (!response.ok) return;
        const release = await response.json();
        if (
          !cancelled &&
          release.schemaVersion === 1 &&
          typeof release.generatedAt === "string" &&
          Date.parse(release.generatedAt) > Date.parse(generatedAt)
        )
          setNext(release.generatedAt);
      } catch {}
    };
    const timer = setInterval(check, 300000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [generatedAt]);
  return next ? (
    <div className="atlas-release-notice" role="status">
      Uudempi aineistovienti on saatavilla (
      {new Date(next).toLocaleString("fi-FI")}).{" "}
      <button type="button" onClick={() => window.location.reload()}>
        Lataa uusi aineistoversio
      </button>
      <span> Uudelleenlataus aloittaa uuden tutkimusistunnon.</span>
    </div>
  ) : null;
}
