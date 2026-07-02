import { useState } from 'react'
import { searchManga } from './api/mangadex'

export default function App() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleSearch(event) {
    event.preventDefault()
    const title = query.trim()
    if (!title) return
    setLoading(true)
    setError(null)
    try {
      const { items } = await searchManga(title)
      setResults(items)
    } catch (err) {
      setError(err.message)
      setResults(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 px-6 py-4">
        <h1 className="text-2xl font-bold tracking-tight">
          Zine <span className="text-sm font-normal text-zinc-400">— personal manga reader</span>
        </h1>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search manga on MangaDex…"
            className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 outline-none placeholder:text-zinc-500 focus:border-orange-500"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-orange-600 px-5 py-2 font-medium hover:bg-orange-500 disabled:opacity-50"
          >
            {loading ? 'Searching…' : 'Search'}
          </button>
        </form>

        {error && (
          <p className="mt-6 rounded-lg border border-red-800 bg-red-950 px-4 py-3 text-red-300">
            {error}
          </p>
        )}

        {results?.length === 0 && (
          <p className="mt-6 text-zinc-400">No results for “{query.trim()}”.</p>
        )}

        {results?.length > 0 && (
          <ul className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {results.map((manga) => (
              <li key={manga.id} className="group">
                <div className="aspect-[2/3] overflow-hidden rounded-lg bg-zinc-900">
                  {manga.coverThumbUrl && (
                    <img
                      src={manga.coverThumbUrl}
                      alt={manga.title}
                      referrerPolicy="no-referrer"
                      loading="lazy"
                      className="h-full w-full object-cover transition group-hover:scale-105"
                    />
                  )}
                </div>
                <p className="mt-2 line-clamp-2 text-sm font-medium">{manga.title}</p>
                <p className="text-xs text-zinc-500">
                  {[manga.year, manga.status].filter(Boolean).join(' · ')}
                </p>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}
