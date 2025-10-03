import React, { useCallback, useEffect, useRef, useState } from "react";
import "./App.css";

type Photo = {
  id: string;
  alt_description: string | null;
  description: string | null;
  urls: {
    small: string;
    regular: string;
  };
  user: {
    name: string;
    links: { html: string };
  };
  width: number;
  height: number;
};

const ACCESS_KEY = import.meta.env.VITE_UNSPLASH_ACCESS_KEY;

export default function App() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"popular" | "latest">("popular");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Photo | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const cacheRef = useRef<Record<string, Record<number, Photo[]>>>({});

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 500);
    return () => clearTimeout(handler);
  }, [query]);

  useEffect(() => {
    const stored = localStorage.getItem("search-history");
    if (stored) setHistory(JSON.parse(stored));
  }, []);

  useEffect(() => {
    localStorage.setItem("search-history", JSON.stringify(history));
  }, [history]);

  const getPhotos = useCallback(
    async (pageNum: number, replace = false) => {
      if (!ACCESS_KEY) {
        setError("No API key found.");
        return;
      }

      const cacheKey = `${debouncedQuery || mode}`;
      const cachedPage = cacheRef.current[cacheKey]?.[pageNum];

      if (cachedPage) {
        setPhotos((prev) => (replace ? cachedPage : [...prev, ...cachedPage]));
        return;
      }

      setLoading(true);
      setError(null);

      try {
        let url = "";
        if (debouncedQuery) {
          url = `https://api.unsplash.com/search/photos?page=${pageNum}&per_page=20&query=${debouncedQuery}`;
        } else {
          url = `https://api.unsplash.com/photos?page=${pageNum}&per_page=20&order_by=${mode}`;
        }

        const res = await fetch(url, {
          headers: {
            Authorization: `Client-ID ${ACCESS_KEY}`,
          },
        });

        const data = await res.json();
        const results = debouncedQuery ? data.results : data;

        if (!cacheRef.current[cacheKey]) cacheRef.current[cacheKey] = {};
        cacheRef.current[cacheKey][pageNum] = results;

        setPhotos((prev) => (replace ? results : [...prev, ...results]));

        if (replace && debouncedQuery) {
          setHistory((prev) => {
            const newHistory = [debouncedQuery, ...prev.filter((h) => h !== debouncedQuery)];
            return newHistory.slice(0, 5);
          });
        }
      } catch (e: any) {
        setError(e.message || "Something went wrong");
      } finally {
        setLoading(false);
      }
    },
    [mode, debouncedQuery]
  );

  useEffect(() => {
    setPhotos([]);
    setPage(1);
    getPhotos(1, true);
  }, [mode, debouncedQuery, getPhotos]);

  useEffect(() => {
    if (!sentinelRef.current) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !loading) {
            setPage((p) => p + 1);
          }
        });
      },
      { rootMargin: "400px" }
    );
    obs.observe(sentinelRef.current);
    return () => obs.disconnect();
  }, [loading]);

  useEffect(() => {
    if (page > 1) {
      getPhotos(page);
    }
  }, [page, getPhotos]);

  const handleHistoryClick = (term: string) => {
    setQuery(term);
    setDebouncedQuery(term);
  };

  return (
    <div className="app-root">
      <header className="app-header">
        <h1>Photo Gallery</h1>
        <div className="controls">
          <button
            className={mode === "popular" ? "active" : ""}
            onClick={() => setMode("popular")}
          >
            Popular
          </button>
          <button
            className={mode === "latest" ? "active" : ""}
            onClick={() => setMode("latest")}
          >
            Latest
          </button>
        </div>
        <div style={{ marginLeft: "1rem", position: "relative" }}>
          <input
            type="text"
            placeholder="Search photos..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              padding: "0.4rem 0.75rem",
              borderRadius: "8px",
              border: "1px solid rgba(255,255,255,0.2)",
              background: "transparent",
              color: "inherit",
              width: "200px",
            }}
          />
          {history.length > 0 && (
            <div
              style={{
                position: "absolute",
                top: "110%",
                left: 0,
                background: "#071022",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "8px",
                padding: "0.5rem",
                zIndex: 10,
              }}
            >
              {history.map((h) => (
                <div
                  key={h}
                  onClick={() => handleHistoryClick(h)}
                  style={{
                    cursor: "pointer",
                    padding: "0.25rem 0.5rem",
                  }}
                >
                  {h}
                </div>
              ))}
            </div>
          )}
        </div>
      </header>

      <main>
        {error && <div className="error">{error}</div>}

        <section className="grid">
          {photos.map((p) => (
            <article
              key={p.id}
              className="card"
              onClick={() => setSelected(p)}
              tabIndex={0}
            >
              <img
                alt={p.alt_description || `Photo by ${p.user.name}`}
                src={p.urls.small}
                loading="lazy"
                width={p.width}
                height={p.height}
              />
              <div className="meta">{p.user.name}</div>
            </article>
          ))}
        </section>

        <div ref={sentinelRef} style={{ height: 1 }} />

        {loading && <div className="loading">Loading...</div>}
        {!loading && photos.length === 0 && (
          <div className="empty">No photos found.</div>
        )}
      </main>

      {selected && (
        <div className="modal" onClick={() => setSelected(null)} tabIndex={-1}>
          <div className="modal-inner" onClick={(e) => e.stopPropagation()}>
            <button className="close" onClick={() => setSelected(null)}>
              ✕
            </button>
            <img
              src={selected.urls.regular}
              alt={selected.alt_description || "Photo"}
            />
            <div className="modal-meta">
              <h3>
                {selected.description ||
                  selected.alt_description ||
                  "Untitled"}
              </h3>
              <p>
                Photo by{" "}
                <a
                  href={selected.user.links.html}
                  target="_blank"
                  rel="noreferrer"
                >
                  {selected.user.name}
                </a>
              </p>
            </div>
          </div>
        </div>
      )}

      <footer className="app-footer">Photos from Unsplash</footer>
    </div>
  );
}
